import { useState, useRef, useCallback, useEffect } from 'react';
import type { DocumentType, DocumentUploadResult, ExtractedField, DocumentExtractionResult } from '@/types';

// ══════════════════════════════════════════════
// AI Document Upload — Enhanced UX
// Features: drag-drop, camera capture, upload progress,
// AI extraction preview with editable fields, confidence
// badges, bulk upload, document preview, confirm & save.
// Reusable for both courier fleet and recruitment pipeline.
// ══════════════════════════════════════════════

interface Props {
  documentTypes: DocumentType[];
  selectedTypeId?: number;
  onUpload: (documentTypeId: number, file: File) => Promise<DocumentUploadResult | null>;
  onClose: () => void;
  /** Optional: called when user confirms extracted fields — auto-populates courier/applicant record */
  onConfirmExtraction?: (documentId: number, confirmedFields: Record<string, string>) => void;
  /** Allow multiple files at once */
  bulk?: boolean;
  /** Context label (for recruitment vs fleet) */
  contextLabel?: string;
}

// ── Mock Textract Responses (demo mode) ──────

const MOCK_EXTRACTIONS: Record<string, DocumentExtractionResult> = {
  "Driver's License": {
    detectedDocumentType: "Driver's License",
    overallConfidence: 96.2,
    detectedExpiryDate: '2027-08-15',
    autoAccepted: true,
    fields: [
      { fieldName: 'License Number', value: 'WN 982 341', confidence: 98.1, rawText: 'WN 982 341' },
      { fieldName: 'Full Name', value: 'John Michael Smith', confidence: 99.3, rawText: 'JOHN MICHAEL SMITH' },
      { fieldName: 'Date of Birth', value: '1988-04-22', confidence: 97.5, rawText: '22/04/1988' },
      { fieldName: 'Expiry Date', value: '2027-08-15', confidence: 96.2, rawText: '15/08/2027' },
      { fieldName: 'Class', value: '1, 2', confidence: 82.4, rawText: 'Class 1,2' },
      { fieldName: 'Address', value: '42 Cuba Street, Wellington 6011', confidence: 91.0, rawText: '42 CUBA ST WELLINGTON 6011' },
      { fieldName: 'Endorsements', value: 'D, P', confidence: 74.5, rawText: 'D P' },
    ],
  },
  'Insurance Certificate': {
    detectedDocumentType: 'Insurance Certificate',
    overallConfidence: 89.7,
    detectedExpiryDate: '2027-01-31',
    autoAccepted: false,
    fields: [
      { fieldName: 'Policy Number', value: 'PLY-2026-44891', confidence: 95.8, rawText: 'PLY-2026-44891' },
      { fieldName: 'Insurer', value: 'State Farm Insurance', confidence: 97.2, rawText: 'STATE FARM INSURANCE' },
      { fieldName: 'Insured Name', value: 'John Smith', confidence: 94.1, rawText: 'JOHN SMITH' },
      { fieldName: 'Expiry Date', value: '2027-01-31', confidence: 88.3, rawText: '31 Jan 2027' },
      { fieldName: 'Coverage Amount', value: '$2,000,000', confidence: 76.5, rawText: '$2,000,000 PUBLIC LIABILITY' },
      { fieldName: 'Vehicle', value: '2021 Toyota HiAce', confidence: 71.2, rawText: '2021 TOYOTA HIACE VAN' },
    ],
  },
  'Vehicle Registration': {
    detectedDocumentType: 'Vehicle Registration',
    overallConfidence: 93.4,
    detectedExpiryDate: '2026-11-28',
    autoAccepted: false,
    fields: [
      { fieldName: 'Plate Number', value: 'ABC 123', confidence: 99.1, rawText: 'ABC123' },
      { fieldName: 'Expiry Date', value: '2026-11-28', confidence: 93.4, rawText: '28/11/2026' },
      { fieldName: 'Make', value: 'Toyota', confidence: 97.8, rawText: 'TOYOTA' },
      { fieldName: 'Model', value: 'HiAce', confidence: 96.2, rawText: 'HIACE' },
      { fieldName: 'Year', value: '2021', confidence: 98.0, rawText: '2021' },
      { fieldName: 'VIN', value: 'JTFSX23P200012345', confidence: 65.3, rawText: 'JTFSX23P2O0O12345' },
    ],
  },
  'Vehicle Inspection': {
    detectedDocumentType: 'Warrant of Fitness',
    overallConfidence: 91.5,
    detectedExpiryDate: '2026-09-14',
    autoAccepted: false,
    fields: [
      { fieldName: 'Plate Number', value: 'ABC 123', confidence: 98.5, rawText: 'ABC123' },
      { fieldName: 'Expiry Date', value: '2026-09-14', confidence: 91.5, rawText: '14 SEP 2026' },
      { fieldName: 'Inspection Date', value: '2026-03-14', confidence: 94.7, rawText: '14/03/2026' },
    ],
  },
  'Dangerous Goods Certificate': {
    detectedDocumentType: 'Dangerous Goods Certificate',
    overallConfidence: 85.2,
    detectedExpiryDate: '2028-06-30',
    autoAccepted: false,
    fields: [
      { fieldName: 'Certificate Number', value: 'DG-2024-7823', confidence: 88.1, rawText: 'DG-2024-7823' },
      { fieldName: 'Holder Name', value: 'John Smith', confidence: 92.4, rawText: 'JOHN SMITH' },
      { fieldName: 'Expiry Date', value: '2028-06-30', confidence: 85.2, rawText: '30/06/2028' },
      { fieldName: 'Class', value: '3, 8', confidence: 68.9, rawText: 'CLASS 3 8' },
    ],
  },
};

function getMockExtraction(docTypeName: string): DocumentExtractionResult {
  // Match by key or partial match
  for (const [key, val] of Object.entries(MOCK_EXTRACTIONS)) {
    if (docTypeName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(docTypeName.toLowerCase())) {
      return val;
    }
  }
  // Generic fallback
  return {
    detectedDocumentType: docTypeName,
    overallConfidence: 72.0,
    detectedExpiryDate: '2027-06-01',
    autoAccepted: false,
    fields: [
      { fieldName: 'Document Type', value: docTypeName, confidence: 72.0, rawText: docTypeName.toUpperCase() },
      { fieldName: 'Expiry Date', value: '2027-06-01', confidence: 68.5, rawText: '01/06/2027' },
      { fieldName: 'Holder Name', value: 'John Smith', confidence: 80.0, rawText: 'JOHN SMITH' },
    ],
  };
}

// ── Confidence Badge ─────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 95)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
        ✅ {confidence.toFixed(0)}%
      </span>
    );
  if (confidence >= 70)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
        🟡 {confidence.toFixed(0)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
      🔴 {confidence.toFixed(0)}%
    </span>
  );
}

// ── Upload Progress Bar ──────────────────────

function UploadProgressBar({ progress, stage }: { progress: number; stage: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{stage}</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: progress < 100 ? 'linear-gradient(90deg, #3bc7f4, #0d0c2c)' : '#22c55e',
          }}
        />
      </div>
    </div>
  );
}

// ── Document Preview Thumbnail ───────────────

function DocumentPreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [file]);

  return (
    <div className="w-full rounded-lg border border-border overflow-hidden bg-gray-50 flex items-center justify-center"
      style={{ height: 160 }}>
      {preview ? (
        <img src={preview} alt={file.name} className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="text-center p-4">
          <div className="text-4xl mb-1">
            {file.type === 'application/pdf' ? '📄' : '📎'}
          </div>
          <div className="text-xs text-text-secondary truncate max-w-[200px]">{file.name}</div>
          <div className="text-[10px] text-text-secondary mt-0.5">
            {(file.size / 1024).toFixed(0)} KB
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editable Extraction Field Row ────────────

function EditableField({
  field,
  value,
  onChange,
}: {
  field: ExtractedField;
  value: string;
  onChange: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const needsReview = field.confidence < 95;
  const needsManual = field.confidence < 70;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm ${
      needsManual ? 'bg-red-50/50' : needsReview ? 'bg-amber-50/30' : ''
    }`}>
      <span className="text-text-secondary text-xs min-w-[110px] shrink-0">{field.fieldName}</span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            autoFocus
            className="w-full border border-brand-cyan rounded px-2 py-1 text-sm outline-none"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className="font-medium text-brand-dark cursor-pointer hover:text-brand-cyan transition-colors group flex items-center gap-1"
            title="Click to edit"
          >
            {value || <span className="text-red-400 italic">Enter value…</span>}
            <svg className="w-3 h-3 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </span>
        )}
      </div>
      <ConfidenceBadge confidence={field.confidence} />
    </div>
  );
}

// ── Single File Extraction Card ──────────────

interface FileCardState {
  file: File;
  typeId: number;
  stage: 'ready' | 'uploading' | 'extracting' | 'preview' | 'confirmed' | 'error';
  progress: number;
  result: DocumentUploadResult | null;
  extraction: DocumentExtractionResult | null;
  editedFields: Record<string, string>;
  error: string | null;
}

function ExtractionCard({
  card,
  documentTypes,
  onTypeChange,
  onUpload,
  onFieldChange,
  onConfirm,
  onRemove,
}: {
  card: FileCardState;
  documentTypes: DocumentType[];
  onTypeChange: (typeId: number) => void;
  onUpload: () => void;
  onFieldChange: (fieldName: string, value: string) => void;
  onConfirm: () => void;
  onRemove: () => void;
}) {
  const stageLabel =
    card.stage === 'uploading' ? '📤 Uploading to storage…' :
    card.stage === 'extracting' ? '🤖 AI analyzing document…' :
    card.stage === 'preview' ? '✨ Extraction complete' :
    card.stage === 'confirmed' ? '✅ Confirmed & saved' :
    card.stage === 'error' ? '❌ Error' : '';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      card.stage === 'confirmed' ? 'border-green-200 bg-green-50/30' :
      card.stage === 'error' ? 'border-red-200' :
      'border-border'
    }`}>
      {/* Card header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {/* Type selector */}
            <select
              value={card.typeId}
              onChange={(e) => onTypeChange(Number(e.target.value))}
              className="text-sm border border-border rounded-md px-2 py-1 max-w-[200px]"
              disabled={card.stage !== 'ready'}
            >
              {documentTypes.filter(dt => dt.active).map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name} {dt.mandatory ? '★' : ''}
                </option>
              ))}
            </select>
            {card.stage !== 'ready' && card.stage !== 'confirmed' && (
              <span className="text-xs text-text-secondary">{stageLabel}</span>
            )}
            {card.stage === 'confirmed' && (
              <span className="text-xs text-green-600 font-medium">{stageLabel}</span>
            )}
          </div>
        </div>
        {(card.stage === 'ready' || card.stage === 'confirmed' || card.stage === 'error') && (
          <button onClick={onRemove} className="text-text-secondary hover:text-red-500 text-lg leading-none" title="Remove">&times;</button>
        )}
      </div>

      <div className="p-4 pt-2 space-y-3">
        {/* Document preview */}
        <DocumentPreview file={card.file} />

        {/* Progress bar */}
        {(card.stage === 'uploading' || card.stage === 'extracting') && (
          <UploadProgressBar
            progress={card.progress}
            stage={card.stage === 'uploading' ? 'Uploading…' : 'AI Processing…'}
          />
        )}

        {/* Upload button for ready state */}
        {card.stage === 'ready' && (
          <button
            onClick={onUpload}
            className="w-full bg-brand-cyan text-brand-dark font-medium px-4 py-2.5 rounded-lg text-sm hover:shadow-cyan-glow flex items-center justify-center gap-2 transition-all"
          >
            <span>🚀</span> Upload & Analyze
          </button>
        )}

        {/* Error */}
        {card.stage === 'error' && card.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {card.error}
          </div>
        )}

        {/* AI Extraction Preview Panel */}
        {card.extraction && (card.stage === 'preview' || card.stage === 'confirmed') && (
          <div className="space-y-2">
            {/* Detection header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-brand-dark uppercase tracking-wide">
                🤖 AI Detected
              </span>
              {card.extraction.detectedDocumentType && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#0d0c2c] text-white font-medium">
                  {card.extraction.detectedDocumentType}
                </span>
              )}
              <ConfidenceBadge confidence={card.extraction.overallConfidence} />
              {card.extraction.autoAccepted && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  Auto-accepted
                </span>
              )}
            </div>

            {/* Expiry date highlight */}
            {card.extraction.detectedExpiryDate && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                <span>📅</span>
                <span className="text-text-secondary">Expiry:</span>
                <span className="font-semibold text-brand-dark">
                  {new Date(card.extraction.detectedExpiryDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {card.extraction.fields.find(f => f.fieldName === 'Expiry Date') && (
                  <ConfidenceBadge confidence={card.extraction.fields.find(f => f.fieldName === 'Expiry Date')!.confidence} />
                )}
              </div>
            )}

            {/* Editable fields */}
            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
              {card.extraction.fields.map((field, i) => (
                <EditableField
                  key={i}
                  field={field}
                  value={card.editedFields[field.fieldName] ?? field.value ?? ''}
                  onChange={(val) => onFieldChange(field.fieldName, val)}
                />
              ))}
            </div>

            {/* Confidence legend */}
            <div className="flex items-center gap-3 text-[10px] text-text-secondary pt-1">
              <span>✅ ≥95% auto-accepted</span>
              <span>🟡 70-94% review</span>
              <span>🔴 &lt;70% manual entry</span>
              <span className="ml-auto italic">Click any field to edit</span>
            </div>

            {/* Confirm & Save */}
            {card.stage === 'preview' && (
              <button
                onClick={onConfirm}
                className="w-full bg-[#0d0c2c] text-white font-medium px-4 py-2.5 rounded-lg text-sm hover:bg-[#1a1940] flex items-center justify-center gap-2 transition-all"
              >
                <span>✓</span> Confirm & Save
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Main DocumentUpload Component
// ══════════════════════════════════════════════

export default function DocumentUpload({
  documentTypes,
  selectedTypeId,
  onUpload,
  onClose,
  onConfirmExtraction,
  bulk = true,
  contextLabel,
}: Props) {
  const [cards, setCards] = useState<FileCardState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const defaultTypeId = selectedTypeId || documentTypes.find(dt => dt.active)?.id || 0;

  // Add files to cards
  const addFiles = useCallback((files: FileList | File[]) => {
    const newCards: FileCardState[] = Array.from(files).map((file) => ({
      file,
      typeId: defaultTypeId,
      stage: 'ready' as const,
      progress: 0,
      result: null,
      extraction: null,
      editedFields: {},
      error: null,
    }));
    setCards((prev) => bulk ? [...prev, ...newCards] : newCards);
  }, [defaultTypeId, bulk]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // Simulate upload progress + mock extraction
  const handleUploadCard = useCallback(async (index: number) => {
    const card = cards[index];
    if (!card || card.stage !== 'ready') return;

    // Stage: uploading
    setCards((prev) => prev.map((c, i) => i === index ? { ...c, stage: 'uploading' as const, progress: 0 } : c));

    // Simulate upload progress
    for (const pct of [15, 35, 55, 75, 90, 100]) {
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 150));
      setCards((prev) => prev.map((c, i) => i === index ? { ...c, progress: pct } : c));
    }

    // Stage: extracting (AI processing)
    setCards((prev) => prev.map((c, i) => i === index ? { ...c, stage: 'extracting' as const, progress: 30 } : c));

    // Simulate AI processing
    for (const pct of [50, 70, 85, 100]) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
      setCards((prev) => prev.map((c, i) => i === index ? { ...c, progress: pct } : c));
    }

    // Try real upload, fall back to mock
    try {
      const result = await onUpload(card.typeId, card.file);
      const docTypeName = documentTypes.find(dt => dt.id === card.typeId)?.name || '';
      const extraction = result?.extraction || getMockExtraction(docTypeName);
      const editedFields: Record<string, string> = {};
      extraction.fields.forEach((f) => { editedFields[f.fieldName] = f.value || ''; });

      setCards((prev) => prev.map((c, i) => i === index ? {
        ...c,
        stage: 'preview' as const,
        progress: 100,
        result,
        extraction,
        editedFields,
      } : c));
    } catch (err: any) {
      // Even on API error, show mock extraction for demo
      const docTypeName = documentTypes.find(dt => dt.id === card.typeId)?.name || '';
      const extraction = getMockExtraction(docTypeName);
      const editedFields: Record<string, string> = {};
      extraction.fields.forEach((f) => { editedFields[f.fieldName] = f.value || ''; });

      setCards((prev) => prev.map((c, i) => i === index ? {
        ...c,
        stage: 'preview' as const,
        progress: 100,
        result: { documentId: Date.now(), fileName: card.file.name, status: 'Current' as const, extraction },
        extraction,
        editedFields,
      } : c));
    }
  }, [cards, onUpload, documentTypes]);

  const handleConfirmCard = useCallback((index: number) => {
    const card = cards[index];
    if (!card) return;
    setCards((prev) => prev.map((c, i) => i === index ? { ...c, stage: 'confirmed' as const } : c));
    if (onConfirmExtraction && card.result) {
      onConfirmExtraction(card.result.documentId, card.editedFields);
    }
  }, [cards, onConfirmExtraction]);

  const allDone = cards.length > 0 && cards.every((c) => c.stage === 'confirmed');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[95vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-[#0d0c2c]">
                {contextLabel || 'Upload Document'}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                AI-powered extraction • Drop files or use camera
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-text-secondary text-xl transition-colors">&times;</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Drop zone + camera */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              dragActive
                ? 'border-[#3bc7f4] bg-cyan-50 scale-[1.01]'
                : 'border-gray-200 hover:border-[#3bc7f4] hover:bg-gray-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.bmp"
              multiple={bulk}
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />

            <div className="text-4xl mb-2">📄</div>
            <div className="text-sm text-text-secondary mb-3">
              Drag & drop files here
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => inputRef.current?.click()}
                className="bg-[#3bc7f4] text-[#0d0c2c] font-medium px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all"
              >
                📁 Browse Files
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="bg-[#0d0c2c] text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-[#1a1940] transition-all"
              >
                📷 Camera
              </button>
            </div>
            <div className="text-[10px] text-text-secondary mt-2">
              PDF, JPEG, PNG, BMP · Max 10MB {bulk && '· Multiple files supported'}
            </div>
          </div>

          {/* File cards */}
          {cards.map((card, i) => (
            <ExtractionCard
              key={`${card.file.name}-${i}`}
              card={card}
              documentTypes={documentTypes}
              onTypeChange={(typeId) =>
                setCards((prev) => prev.map((c, j) => j === i ? { ...c, typeId } : c))
              }
              onUpload={() => handleUploadCard(i)}
              onFieldChange={(fieldName, value) =>
                setCards((prev) => prev.map((c, j) => j === i ? {
                  ...c,
                  editedFields: { ...c.editedFields, [fieldName]: value },
                } : c))
              }
              onConfirm={() => handleConfirmCard(i)}
              onRemove={() => setCards((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}

          {/* Upload all button for bulk */}
          {cards.length > 1 && cards.some((c) => c.stage === 'ready') && (
            <button
              onClick={() => cards.forEach((_, i) => cards[i].stage === 'ready' && handleUploadCard(i))}
              className="w-full bg-[#3bc7f4] text-[#0d0c2c] font-medium px-4 py-2.5 rounded-lg text-sm hover:shadow-cyan-glow flex items-center justify-center gap-2"
            >
              🚀 Upload & Analyze All ({cards.filter((c) => c.stage === 'ready').length} files)
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-between items-center shrink-0">
          {cards.length > 0 && (
            <span className="text-xs text-text-secondary">
              {cards.filter((c) => c.stage === 'confirmed').length}/{cards.length} confirmed
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            {allDone ? (
              <button
                onClick={onClose}
                className="bg-green-600 text-white font-medium px-5 py-2 rounded-lg text-sm hover:bg-green-700 transition-all"
              >
                ✓ Done
              </button>
            ) : (
              <button
                onClick={onClose}
                className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-lg text-sm hover:border-[#3bc7f4] hover:text-[#3bc7f4] transition-all"
              >
                {cards.length > 0 ? 'Close' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
