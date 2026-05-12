import { useState, useRef, useCallback } from 'react';

// ── Confidence Badge ────────────────────────────────────

export function AiConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 95)
    return <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium text-green-600 bg-green-50 border-green-200">AI ✓</span>;
  if (confidence >= 70)
    return <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium text-amber-600 bg-amber-50 border-amber-200">AI ~</span>;
  return <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium text-red-600 bg-red-50 border-red-200">Review</span>;
}

// ── Mock Extraction Data ────────────────────────────────

const MOCK_EXTRACTIONS: Record<string, Record<string, { value: string; confidence: number }>> = {
  "Driver's License": {
    firstName:    { value: 'James',           confidence: 98 },
    lastName:     { value: 'Wilson',          confidence: 97 },
    dob:          { value: '1990-04-22',      confidence: 93 },
    address:      { value: '42 Queen Street, Auckland 1010', confidence: 88 },
    licenseNumber:{ value: 'DL-29384756',     confidence: 96 },
    licenseExpiry:{ value: '2027-08-15',      confidence: 95 },
    gender:       { value: 'Male',            confidence: 85 },
    licenseClass: { value: 'Class 1, Class 2', confidence: 91 },
    endorsements: { value: 'D, W',            confidence: 87 },
  },
  "Vehicle Registration": {
    plateNumber:  { value: 'KXR-902',         confidence: 95 },
    make:         { value: 'Toyota',          confidence: 92 },
    model:        { value: 'Hiace',           confidence: 90 },
    year:         { value: '2021',            confidence: 88 },
    regoExpiry:   { value: '2026-11-30',      confidence: 91 },
    vehicleType:  { value: 'Van',             confidence: 80 },
  },
  "Insurance Certificate": {
    policyNumber:    { value: 'INS-482917',    confidence: 92 },
    insuranceCompany:{ value: 'State Farm',    confidence: 88 },
    coverageAmount:  { value: '$1,000,000',    confidence: 75 },
    expiryDate:      { value: '2027-01-15',    confidence: 90 },
  },
  "WOF Certificate": {
    wofExpiry:  { value: '2026-09-01', confidence: 96 },
    vehicleId:  { value: 'KXR-902',   confidence: 88 },
  },
};

function getMockExtraction(docTypeName: string): Record<string, { value: string; confidence: number }> {
  // Match by key substring
  for (const [key, fields] of Object.entries(MOCK_EXTRACTIONS)) {
    if (docTypeName.toLowerCase().includes(key.toLowerCase().split(' ')[0].toLowerCase())
        || key.toLowerCase().includes(docTypeName.toLowerCase().split(' ')[0].toLowerCase())) {
      return fields;
    }
  }
  // Exact match
  return MOCK_EXTRACTIONS[docTypeName] || { documentType: { value: docTypeName, confidence: 72 } };
}

// ── ScanToFill Component ────────────────────────────────

interface ScanToFillProps {
  label: string;
  docTypeName: string;
  onExtracted: (fields: Record<string, { value: string; confidence: number }>) => void;
  accent?: string;
}

type ScanState = 'idle' | 'processing' | 'done';

export default function ScanToFill({ label, docTypeName, onExtracted, accent = '#3bc7f4' }: ScanToFillProps) {
  const [state, setState] = useState<ScanState>('idle');
  const [fileName, setFileName] = useState('');
  const [extractedFields, setExtractedFields] = useState<Record<string, { value: string; confidence: number }> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setState('processing');

    // Simulate AI processing delay
    setTimeout(() => {
      const fields = getMockExtraction(docTypeName);
      setExtractedFields(fields);
      setState('done');
      onExtracted(fields);
    }, 1800);
  }, [docTypeName, onExtracted]);

  const reset = () => {
    setState('idle');
    setFileName('');
    setExtractedFields(null);
  };

  return (
    <div className="mb-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      {state === 'idle' && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-brand-cyan transition-colors"
          style={{ borderColor: accent + '66' }}
        >
          <div className="text-2xl mb-1">📸</div>
          <div className="text-sm font-semibold" style={{ color: accent }}>
            {label}
          </div>
          <div className="text-xs text-text-secondary mt-0.5">
            {docTypeName.toLowerCase().includes('licen')
              ? 'Upload or take photos of both front and back'
              : 'Upload photo or PDF to auto-fill fields below'
            }
          </div>
        </div>
      )}

      {state === 'processing' && (
        <div className="border border-brand-cyan/30 bg-brand-cyan/5 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-brand-cyan">Analysing with AI…</span>
          </div>
          <div className="text-xs text-text-secondary mt-1">{fileName}</div>
        </div>
      )}

      {state === 'done' && extractedFields && (
        <div className="border border-green-300 bg-green-50/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">✅</span>
              <span className="text-xs font-semibold text-green-700">
                {Object.keys(extractedFields).length} fields extracted from {fileName}
              </span>
            </div>
            <button onClick={reset} className="text-xs text-brand-cyan hover:underline">
              Re-scan
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(extractedFields).map(([key, { value, confidence }]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs py-0.5">
                <AiConfidenceBadge confidence={confidence} />
                <span className="text-text-secondary truncate">{key}:</span>
                <span className="font-medium text-brand-dark truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
