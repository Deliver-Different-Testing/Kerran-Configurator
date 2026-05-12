import { useState, useCallback } from 'react';
import StepWizard from '@/components/common/StepWizard';
import FileUploadZone from '@/components/import/FileUploadZone';
import AutoMateMapper from '@/components/import/AutoMateMapper';
import ValidationResults from '@/components/import/ValidationResults';
import ImportProgress from '@/components/import/ImportProgress';
import {
  courierImportService,
  type UploadResult,
  type CourierColumnMapping,
  type AiColumnSuggestion,
  type CourierValidationResult,
  type CourierImportResult,
} from '@/services/np_importService';

type SourceType = 'file' | 'paste';

export default function CourierImport() {
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [pasteText, setPasteText] = useState('');

  // Step 2
  const [mapping, setMapping] = useState<CourierColumnMapping>({});
  const [suggestions, setSuggestions] = useState<AiColumnSuggestion[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Step 3
  const [validationResult, setValidationResult] = useState<CourierValidationResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Step 4
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<CourierImportResult | null>(null);

  const runAiMapping = useCallback(async (result: UploadResult) => {
    setIsAiThinking(true);
    try {
      const aiResponse = await courierImportService.aiMapColumns(
        result.columns,
        result.previewRows.slice(0, 3),
      );
      setSuggestions(aiResponse.suggestions);
      // Apply AI mappings to the mapping state
      const newMapping: CourierColumnMapping = {};
      for (const s of aiResponse.suggestions) {
        if (s.mappedColumn) {
          (newMapping as any)[s.systemField] = s.mappedColumn;
        }
      }
      setMapping(newMapping);
    } catch {
      // Silently fall back — user can map manually
    } finally {
      setIsAiThinking(false);
    }
  }, []);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const result = await courierImportService.uploadFile(file);
      setUploadResult(result);
      setAllRows(result.previewRows);
      setSourceType('file');
    } catch (err: any) {
      alert(err?.response?.data || err?.message || 'Failed to parse file.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePaste = useCallback(() => {
    try {
      const result = courierImportService.parsePastedData(pasteText);
      setUploadResult(result);
      setAllRows(result.allRows || result.previewRows);
      setSourceType('paste');
    } catch (err: any) {
      alert(err?.message || 'Failed to parse pasted data.');
    }
  }, [pasteText]);

  const proceedToMapping = async () => {
    if (!uploadResult) return;
    setStep(2);
    await runAiMapping(uploadResult);
  };

  const handleValidate = async () => {
    if (!uploadResult || !mapping.firstName) return;
    setIsLoading(true);
    try {
      const result = await courierImportService.validate(allRows, mapping);
      setValidationResult(result);
      setSelectedRows(new Set(result.rows.filter((r) => r.status === 'valid').map((r) => r.rowNumber)));
      setStep(3);
    } catch (err: any) {
      alert(err?.response?.data || err?.message || 'Validation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult) return;
    const rowsToImport = validationResult.rows.filter((r) => selectedRows.has(r.rowNumber));
    if (rowsToImport.length === 0) { alert('No rows selected.'); return; }

    setStep(4);
    setIsImporting(true);
    setImportProgress(0);

    const interval = setInterval(() => {
      setImportProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 500);

    try {
      const result = await courierImportService.execute(rowsToImport);
      clearInterval(interval);
      setImportProgress(100);
      setTimeout(() => { setIsImporting(false); setImportResult(result); }, 500);
    } catch (err: any) {
      clearInterval(interval);
      setIsImporting(false);
      alert(err?.response?.data || err?.message || 'Import failed.');
    }
  };

  const canProceedToMap = !!uploadResult;
  const requiredMapped = !!(mapping.firstName && mapping.lastName && mapping.phone);

  return (
    <div className="max-w-5xl mx-auto fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Import Couriers</h1>
        <p className="text-sm text-text-secondary mt-1">Bulk import your courier fleet from a spreadsheet</p>
      </div>

      <StepWizard
        steps={['Upload', 'Auto-Mate Maps', 'Validate', 'Import']}
        current={step}
      />

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'file' as SourceType, icon: '📄', title: 'Upload File', desc: 'XLSX, XLS, or CSV' },
              { key: 'paste' as SourceType, icon: '📋', title: 'Paste Data', desc: 'Tab or comma separated' },
            ].map((src) => (
              <button
                key={src.key}
                onClick={() => setSourceType(src.key)}
                className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-lg ${
                  sourceType === src.key ? 'border-brand-cyan bg-brand-cyan/5' : 'border-border hover:border-brand-cyan/50 bg-white'
                }`}
              >
                <span className="text-3xl">{src.icon}</span>
                <h3 className="font-bold text-text-primary mt-3">{src.title}</h3>
                <p className="text-sm text-text-secondary">{src.desc}</p>
              </button>
            ))}
          </div>

          {sourceType === 'file' && (
            <FileUploadZone onFileSelected={handleFileSelected} isLoading={isLoading} />
          )}

          {sourceType === 'paste' && (
            <div className="space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your data here (tab or comma separated, first row = headers)…"
                rows={8}
                className="w-full px-4 py-3 text-sm rounded-lg font-mono resize-y"
              />
              <button
                onClick={handlePaste}
                disabled={!pasteText.trim()}
                className="px-5 py-2.5 font-bold rounded-full bg-brand-cyan text-brand-dark hover:bg-brand-cyan transition-all disabled:opacity-50"
              >
                Parse Data
              </button>
            </div>
          )}

          {uploadResult && (
            <div className="bg-success/5 border border-success/20 rounded-xl p-4 flex items-center gap-4">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-bold text-text-primary">
                  {uploadResult.totalRows} rows, {uploadResult.columns.length} columns detected
                </p>
                <p className="text-sm text-text-secondary">
                  Columns: {uploadResult.columns.join(', ')}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={proceedToMapping}
              disabled={!canProceedToMap}
              className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:bg-brand-cyan transition-all disabled:opacity-50"
            >
              Continue — Auto-Map Columns
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Auto-Mate Maps Columns */}
      {step === 2 && uploadResult && (
        <div className="space-y-6">
          <AutoMateMapper
            columns={uploadResult.columns}
            previewRows={uploadResult.previewRows}
            suggestions={suggestions}
            isThinking={isAiThinking}
            mapping={mapping}
            onMappingChange={setMapping}
          />

          {!isAiThinking && (
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-3 font-bold rounded-full bg-white text-text-secondary border border-border hover:bg-surface-cream transition-all"
              >
                ← Back
              </button>
              <button
                onClick={handleValidate}
                disabled={!requiredMapped || isLoading}
                className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:bg-brand-cyan transition-all disabled:opacity-50"
              >
                {isLoading ? 'Validating…' : 'Validate & Review →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Validate & Review */}
      {step === 3 && validationResult && (
        <div className="space-y-6">
          <ValidationResults
            rows={validationResult.rows}
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            validCount={validationResult.validCount}
            duplicateCount={validationResult.duplicateCount}
            errorCount={validationResult.errorCount}
          />

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-3 font-bold rounded-full bg-white text-text-secondary border border-border hover:bg-surface-cream transition-all"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={selectedRows.size === 0}
              className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:bg-brand-cyan transition-all disabled:opacity-50"
            >
              Import {selectedRows.size} Courier{selectedRows.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Import Results */}
      {step === 4 && (
        <ImportProgress isImporting={isImporting} progress={importProgress} result={importResult} />
      )}
    </div>
  );
}
