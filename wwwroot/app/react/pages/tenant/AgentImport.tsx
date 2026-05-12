import React, { useState, useCallback } from 'react';
import { FileUploadZone } from '@/components/tenant-import/FileUploadZone';
import { GoogleSheetsConnect } from '@/components/tenant-import/GoogleSheetsConnect';
import { ColumnMapper } from '@/components/tenant-import/ColumnMapper';
import { ValidationResults } from '@/components/tenant-import/ValidationResults';
import { ImportProgress } from '@/components/tenant-import/ImportProgress';
import { importService } from '@/services/tenant_importService';
import type { ColumnMapping, ValidationResult, ValidatedRow, ImportResult, UploadResult } from '@/services/tenant_importService';

type SourceType = 'file' | 'google' | 'paste';

export function AgentImport() {
  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 data
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [pasteText, setPasteText] = useState('');

  // Step 2 data
  const [mapping, setMapping] = useState<ColumnMapping>({});

  // Step 3 data
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Step 4 data
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const result = await importService.uploadFile(file);
      setUploadResult(result);
      setAllRows(result.previewRows); // preview rows for mapping; full data sent to validate
      setSourceType('file');
    } catch (err: any) {
      alert(err?.response?.data || err?.message || 'Failed to parse file.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePaste = useCallback(() => {
    try {
      const result = importService.parsePastedData(pasteText);
      setUploadResult(result);
      setAllRows(result.previewRows);
      setSourceType('paste');
    } catch (err: any) {
      alert(err?.message || 'Failed to parse pasted data.');
    }
  }, [pasteText]);

  const handleValidate = async () => {
    if (!uploadResult || !mapping.name) return;
    setIsLoading(true);
    try {
      const result = await importService.validate(allRows, mapping);
      setValidationResult(result);
      // Auto-select valid + association_match rows
      const autoSelected = new Set(
        result.rows
          .filter((r) => r.status === 'valid' || r.status === 'association_match')
          .map((r) => r.rowNumber),
      );
      setSelectedRows(autoSelected);
      setStep(2);
    } catch (err: any) {
      alert(err?.response?.data || err?.message || 'Validation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult) return;
    const rowsToImport = validationResult.rows.filter((r) => selectedRows.has(r.rowNumber));
    if (rowsToImport.length === 0) {
      alert('No rows selected for import.');
      return;
    }

    setStep(3);
    setIsImporting(true);
    setImportProgress(0);

    // Simulate progress while waiting for API
    const interval = setInterval(() => {
      setImportProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 500);

    try {
      const result = await importService.execute(rowsToImport);
      clearInterval(interval);
      setImportProgress(100);
      setTimeout(() => {
        setIsImporting(false);
        setImportResult(result);
      }, 500);
    } catch (err: any) {
      clearInterval(interval);
      setIsImporting(false);
      alert(err?.response?.data || err?.message || 'Import failed.');
    }
  };

  const canProceedToMap = !!uploadResult;
  const canProceedToValidate = !!mapping.name; // Name is required

  const steps = [
    { label: 'Upload', icon: '📤' },
    { label: 'Map Columns', icon: '🔗' },
    { label: 'Validate', icon: '✅' },
    { label: 'Import', icon: '🚀' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step
                    ? 'bg-success text-white'
                    : i === step
                    ? 'bg-brand-cyan text-brand-dark'
                    : 'bg-surface-light text-text-muted'
                }`}
              >
                {i < step ? '✓' : s.icon}
              </div>
              <span className={`text-sm font-bold ${i === step ? 'text-text-primary' : 'text-text-muted'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < step ? 'bg-success' : 'bg-border-light'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Upload Source */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-1">Choose Import Source</h2>
            <p className="text-text-muted text-sm">Upload a spreadsheet, connect Google Sheets, or paste data directly.</p>
          </div>

          {/* Source cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'file' as SourceType, icon: '📄', title: 'Upload File', desc: 'XLSX, XLS, or CSV' },
              { key: 'google' as SourceType, icon: '📊', title: 'Google Sheets', desc: 'Paste sheet URL' },
              { key: 'paste' as SourceType, icon: '📋', title: 'Paste Data', desc: 'Tab or comma separated' },
            ].map((src) => (
              <button
                key={src.key}
                onClick={() => setSourceType(src.key)}
                className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  sourceType === src.key ? 'border-brand-cyan bg-brand-cyan/5' : 'border-border hover:border-brand-cyan/50'
                }`}
              >
                <span className="text-3xl">{src.icon}</span>
                <h3 className="font-bold text-text-primary mt-3">{src.title}</h3>
                <p className="text-sm text-text-muted">{src.desc}</p>
              </button>
            ))}
          </div>

          {/* Source-specific UI */}
          {sourceType === 'file' && (
            <FileUploadZone onFileSelected={handleFileSelected} isLoading={isLoading} />
          )}

          {sourceType === 'google' && (
            <GoogleSheetsConnect
              onParsed={(result) => {
                setUploadResult(result);
                setAllRows(result.allRows);
              }}
              isLoading={isLoading}
              onLoadingChange={setIsLoading}
            />
          )}

          {sourceType === 'paste' && (
            <div className="space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your data here (tab or comma separated, first row = headers)…"
                rows={8}
                className="w-full px-4 py-3 text-sm border-2 border-border rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 font-mono resize-y"
              />
              <button
                onClick={handlePaste}
                disabled={!pasteText.trim()}
                className="px-5 py-2.5 font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all disabled:opacity-50"
              >
                Parse Data
              </button>
            </div>
          )}

          {/* Upload summary */}
          {uploadResult && (
            <div className="bg-success/5 border-2 border-success/20 rounded-lg p-4 flex items-center gap-4">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-bold text-text-primary">
                  File parsed — {uploadResult.totalRows} rows, {uploadResult.columns.length} columns detected
                </p>
                <p className="text-sm text-text-muted">
                  Columns: {uploadResult.columns.join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(1)}
              disabled={!canProceedToMap}
              className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all disabled:opacity-50"
            >
              Continue to Column Mapping →
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Map Columns */}
      {step === 1 && uploadResult && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-1">Map Columns</h2>
            <p className="text-text-muted text-sm">
              Match your spreadsheet columns to agent fields. Only Agent Name is required.
            </p>
          </div>

          <ColumnMapper
            columns={uploadResult.columns}
            previewRows={uploadResult.previewRows}
            totalRows={uploadResult.totalRows}
            mapping={mapping}
            onMappingChange={setMapping}
          />

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(0)}
              className="px-5 py-3 font-bold rounded-full bg-white text-text-secondary border-2 border-border hover:bg-surface-light transition-all"
            >
              ← Back
            </button>
            <button
              onClick={handleValidate}
              disabled={!canProceedToValidate || isLoading}
              className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all disabled:opacity-50"
            >
              {isLoading ? 'Validating…' : 'Validate & Review →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Validate & Review */}
      {step === 2 && validationResult && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-1">Validate & Review</h2>
            <p className="text-text-muted text-sm">
              Review validation results. Select the rows you want to import.
            </p>
          </div>

          <ValidationResults
            rows={validationResult.rows}
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            duplicateCount={validationResult.duplicateCount}
            associationMatchCount={validationResult.associationMatchCount}
            errorCount={validationResult.errorCount}
          />

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-3 font-bold rounded-full bg-white text-text-secondary border-2 border-border hover:bg-surface-light transition-all"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={selectedRows.size === 0}
              className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all disabled:opacity-50"
            >
              Import {selectedRows.size} Agent{selectedRows.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Import Results */}
      {step === 3 && (
        <ImportProgress isImporting={isImporting} progress={importProgress} result={importResult} />
      )}
    </div>
  );
}
