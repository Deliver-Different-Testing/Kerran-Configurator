import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StepWizard from '@/components/common/StepWizard';
import FileUploadZone from '@/components/import/FileUploadZone';
import type { UploadResult, AiColumnSuggestion } from '@/services/np_importService';
import {
  userImportService,
  type UserColumnMapping,
  type UserValidationResult,
  type UserImportResult,
} from '@/services/np_userImportService';

// ── User-specific system fields for the mapper ──

interface SystemField {
  key: keyof UserColumnMapping;
  label: string;
  required: boolean;
}

const USER_SYSTEM_FIELDS: SystemField[] = [
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'role', label: 'Role', required: true },
  { key: 'jobTitle', label: 'Job Title', required: false },
  { key: 'department', label: 'Department', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

const CONFIDENCE_BADGE: Record<string, { icon: string; color: string; bg: string }> = {
  high: { icon: '🟢', color: 'text-success', bg: 'bg-success/10' },
  medium: { icon: '🟡', color: 'text-warning', bg: 'bg-warning/10' },
  low: { icon: '🔴', color: 'text-error', bg: 'bg-error/10' },
};

const STATUS_CONFIG: Record<string, { icon: string; label: string; cls: string }> = {
  valid: { icon: '✅', label: 'Valid', cls: 'text-success bg-success/10' },
  duplicate: { icon: '⚠️', label: 'Duplicate', cls: 'text-warning bg-warning/10' },
  error: { icon: '❌', label: 'Error', cls: 'text-error bg-error/10' },
};

type SourceType = 'file' | 'paste';
type FilterTab = 'all' | 'valid' | 'duplicate' | 'error';

export default function UserImport() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [pasteText, setPasteText] = useState('');

  // Step 2
  const [mapping, setMapping] = useState<UserColumnMapping>({});
  const [suggestions, setSuggestions] = useState<AiColumnSuggestion[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Step 3
  const [validationResult, setValidationResult] = useState<UserValidationResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Step 4
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<UserImportResult | null>(null);

  const runAiMapping = useCallback(async (result: UploadResult) => {
    setIsAiThinking(true);
    try {
      const aiResponse = await userImportService.aiMapColumns(
        result.columns,
        result.previewRows.slice(0, 3),
      );
      setSuggestions(aiResponse.suggestions);
      const newMapping: UserColumnMapping = {};
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
      const result = await userImportService.uploadFile(file);
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
      const result = userImportService.parsePastedData(pasteText);
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
      const result = await userImportService.validate(allRows, mapping);
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
      const result = await userImportService.execute(rowsToImport);
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
  const requiredMapped = !!(mapping.firstName && mapping.lastName && mapping.email && mapping.role);

  const getSuggestion = (field: string) => suggestions.find((s) => s.systemField === field);
  const currentRow = uploadResult?.previewRows[previewIndex] || {};

  const filteredRows = validationResult?.rows.filter(r => activeTab === 'all' || r.status === activeTab) || [];

  const toggleRow = (n: number) => {
    const next = new Set(selectedRows);
    next.has(n) ? next.delete(n) : next.add(n);
    setSelectedRows(next);
  };

  const exportFailed = () => {
    if (!importResult?.failedRows.length) return;
    const headers = ['Row', 'Error', ...Object.keys(importResult.failedRows[0].data)];
    const csvRows = importResult.failedRows.map((r) => [
      r.rowNumber,
      `"${r.error.replace(/"/g, '""')}"`,
      ...Object.values(r.data).map((v) => `"${(v || '').replace(/"/g, '""')}"`),
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'failed_user_imports.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Import Users</h1>
        <p className="text-sm text-text-secondary mt-1">Bulk import team members from a spreadsheet</p>
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
          {isAiThinking ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-brand-cyan flex items-center justify-center animate-pulse">
                  <span className="text-3xl">🤖</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-cyan rounded-full animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-text-primary">Auto-Mate is mapping your columns…</p>
                <p className="text-sm text-text-secondary mt-1">Analyzing headers and sample data to find the best matches</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-brand-cyan"
                    style={{ animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
              <style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }`}</style>
            </div>
          ) : (
            <>
              {/* Auto-Mate header */}
              <div className="bg-brand-cyan/5 rounded-xl p-4 border border-brand-cyan/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-cyan flex items-center justify-center">
                    <span className="text-lg">🤖</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-text-primary text-sm">
                      Auto-Mate mapped {USER_SYSTEM_FIELDS.filter((f) => mapping[f.key]).length} of {USER_SYSTEM_FIELDS.length} fields
                    </p>
                    <p className="text-xs text-text-secondary">
                      {requiredMapped
                        ? '✅ All required fields mapped — review and adjust if needed'
                        : `⚠️ Required field(s) still need mapping`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mapping grid */}
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-0">
                  <div className="px-4 py-3 bg-surface-light/50 font-bold text-xs text-text-secondary uppercase tracking-wider">System Field</div>
                  <div className="px-2 py-3 bg-surface-light/50" />
                  <div className="px-4 py-3 bg-surface-light/50 font-bold text-xs text-text-secondary uppercase tracking-wider">Spreadsheet Column</div>
                  <div className="px-4 py-3 bg-surface-light/50 font-bold text-xs text-text-secondary uppercase tracking-wider">Confidence</div>

                  {USER_SYSTEM_FIELDS.map((field) => {
                    const mapped = mapping[field.key];
                    const isMapped = !!mapped;
                    const suggestion = getSuggestion(field.key);
                    const badge = suggestion ? CONFIDENCE_BADGE[suggestion.confidence] : null;

                    return (
                      <div key={field.key} className="contents">
                        <div className="px-4 py-3 flex items-center gap-2 border-t border-border/50">
                          <span className={`font-bold text-sm ${field.required ? 'text-text-primary' : 'text-text-secondary'}`}>{field.label}</span>
                          {field.required && <span className="text-error text-xs font-bold">*</span>}
                        </div>
                        <div className="px-2 py-3 flex items-center border-t border-border/50">
                          {isMapped ? <span className="text-success text-lg">✓</span> : field.required ? <span className="text-error text-lg">○</span> : <span className="text-text-secondary text-lg">○</span>}
                        </div>
                        <div className="px-4 py-2 border-t border-border/50">
                          <select
                            value={mapped || ''}
                            onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value || undefined })}
                            className={`w-full px-3 py-2 text-sm rounded-lg transition-all ${isMapped ? 'border-success/30 bg-success/5 border' : 'border border-border bg-surface-light'}`}
                          >
                            <option value="">— Skip —</option>
                            {uploadResult.columns.map((col) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                        <div className="px-4 py-3 border-t border-border/50">
                          {suggestion && badge && isMapped ? (
                            <div className="group relative">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.color}`}>
                                {badge.icon} {suggestion.confidenceScore}%
                              </span>
                              {suggestion.reasoning && (
                                <div className="hidden group-hover:block absolute right-0 top-full mt-1 z-10 w-64 p-3 rounded-lg bg-surface-light border border-border shadow-xl text-xs text-text-secondary">
                                  🤖 {suggestion.reasoning}
                                </div>
                              )}
                            </div>
                          ) : <span className="text-xs text-text-secondary">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live preview */}
              <div className="bg-white rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-text-secondary">Preview Row</h4>
                  <div className="flex items-center gap-3 text-sm">
                    <button onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))} disabled={previewIndex === 0} className="px-2 py-1 rounded hover:bg-surface-cream disabled:opacity-30 text-text-secondary">←</button>
                    <span className="text-text-secondary font-bold">{previewIndex + 1} of {uploadResult.previewRows.length}</span>
                    <button onClick={() => setPreviewIndex(Math.min(uploadResult.previewRows.length - 1, previewIndex + 1))} disabled={previewIndex >= uploadResult.previewRows.length - 1} className="px-2 py-1 rounded hover:bg-surface-cream disabled:opacity-30 text-text-secondary">→</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {USER_SYSTEM_FIELDS.filter((f) => mapping[f.key]).map((field) => {
                    const col = mapping[field.key]!;
                    const value = currentRow[col] || '';
                    return (
                      <div key={field.key} className="bg-surface-light rounded-lg p-3 border border-border">
                        <div className="text-xs text-text-secondary mb-1">{field.label}</div>
                        <div className="text-sm font-bold text-text-primary truncate">{value || '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={() => setStep(1)} className="px-5 py-3 font-bold rounded-full bg-white text-text-secondary border border-border hover:bg-surface-cream transition-all">← Back</button>
                <button onClick={handleValidate} disabled={!requiredMapped || isLoading} className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:bg-brand-cyan transition-all disabled:opacity-50">
                  {isLoading ? 'Validating…' : 'Validate & Review →'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Validate & Review */}
      {step === 3 && validationResult && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Valid', value: validationResult.validCount, icon: '✅' },
              { label: 'Duplicates', value: validationResult.duplicateCount, icon: '⚠️' },
              { label: 'Errors', value: validationResult.errorCount, icon: '❌' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 border border-border text-center">
                <span className="text-2xl">{s.icon}</span>
                <div className="text-2xl font-bold text-text-primary mt-1">{s.value}</div>
                <div className="text-xs text-text-secondary">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setSelectedRows(new Set(validationResult.rows.filter(r => r.status === 'valid').map(r => r.rowNumber)))} className="px-4 py-2 text-sm font-bold rounded-full bg-success/10 text-success hover:bg-success/20 transition-all">Select Valid</button>
            <button onClick={() => setSelectedRows(new Set(validationResult.rows.map(r => r.rowNumber)))} className="px-4 py-2 text-sm font-bold rounded-full bg-surface-cream text-text-secondary hover:text-text-primary transition-all">Select All</button>
            <button onClick={() => setSelectedRows(new Set())} className="px-4 py-2 text-sm font-bold rounded-full bg-surface-cream text-text-secondary hover:text-text-primary transition-all">Deselect All</button>
            <span className="ml-auto text-sm text-text-secondary self-center font-bold">{selectedRows.size} of {validationResult.rows.length} selected</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-surface-light rounded-lg p-1">
            {([
              { key: 'all' as FilterTab, label: 'All', count: validationResult.rows.length },
              { key: 'valid' as FilterTab, label: 'Valid', count: validationResult.validCount },
              { key: 'duplicate' as FilterTab, label: 'Duplicates', count: validationResult.duplicateCount },
              { key: 'error' as FilterTab, label: 'Errors', count: validationResult.errorCount },
            ]).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 px-3 py-2 text-sm font-bold rounded-md transition-all ${activeTab === tab.key ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-light sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left w-10"><input type="checkbox" checked={selectedRows.size === validationResult.rows.length && validationResult.rows.length > 0} onChange={() => selectedRows.size === validationResult.rows.length ? setSelectedRows(new Set()) : setSelectedRows(new Set(validationResult.rows.map(r => r.rowNumber)))} /></th>
                    <th className="px-3 py-3 text-left font-bold text-text-secondary w-12">#</th>
                    <th className="px-3 py-3 text-left font-bold text-text-secondary">Status</th>
                    <th className="px-3 py-3 text-left font-bold text-text-secondary">Name</th>
                    <th className="px-3 py-3 text-left font-bold text-text-secondary">Email</th>
                    <th className="px-3 py-3 text-left font-bold text-text-secondary">Role</th>
                    <th className="px-3 py-3 text-left font-bold text-text-secondary">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row) => {
                    const cfg = STATUS_CONFIG[row.status];
                    return (
                      <tr key={row.rowNumber} className="hover:bg-surface-cream/50 transition-colors">
                        <td className="px-3 py-3"><input type="checkbox" checked={selectedRows.has(row.rowNumber)} onChange={() => toggleRow(row.rowNumber)} /></td>
                        <td className="px-3 py-3 text-text-secondary">{row.rowNumber}</td>
                        <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${cfg.cls}`}>{cfg.icon} {cfg.label}</span></td>
                        <td className="px-3 py-3 font-bold text-text-primary">{row.data.firstName || row.data['First Name'] || '—'} {row.data.lastName || row.data['Last Name'] || ''}</td>
                        <td className="px-3 py-3 text-text-secondary">{row.data.email || row.data.Email || '—'}</td>
                        <td className="px-3 py-3 text-text-secondary">{row.data.role || row.data.Role || '—'}</td>
                        <td className="px-3 py-3">
                          {row.status === 'error' && <span className="text-xs text-error">{row.errors.join('; ')}</span>}
                          {row.status === 'duplicate' && <span className="text-xs text-warning">Email already exists</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(2)} className="px-5 py-3 font-bold rounded-full bg-white text-text-secondary border border-border hover:bg-surface-cream transition-all">← Back</button>
            <button onClick={handleImport} disabled={selectedRows.size === 0} className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:bg-brand-cyan transition-all disabled:opacity-50">
              Import {selectedRows.size} User{selectedRows.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Import Results */}
      {step === 4 && (
        <>
          {isImporting ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl">👥</span></div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-text-primary">Importing Users…</p>
                <p className="text-sm text-text-secondary mt-1">Please don't close this page</p>
              </div>
              <div className="w-80">
                <div className="h-3 bg-surface-light rounded-full overflow-hidden">
                  <div className="h-full bg-brand-cyan rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                </div>
                <p className="text-center text-sm text-text-secondary mt-2">{Math.round(importProgress)}%</p>
              </div>
            </div>
          ) : importResult ? (
            <div className="space-y-6">
              <div className="text-center py-6">
                <span className="text-5xl">{importResult.failedCount === 0 ? '🎉' : importResult.successCount > 0 ? '⚡' : '😔'}</span>
                <h2 className="text-2xl font-bold text-text-primary mt-4">Import Complete</h2>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Imported', value: importResult.successCount, icon: '✅' },
                  { label: 'Skipped', value: importResult.totalRows - importResult.successCount - importResult.failedCount, icon: '⏭️' },
                  { label: 'Failed', value: importResult.failedCount, icon: '❌' },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl p-4 border border-border text-center">
                    <span className="text-2xl">{s.icon}</span>
                    <div className="text-2xl font-bold text-text-primary mt-1">{s.value}</div>
                    <div className="text-xs text-text-secondary">{s.label}</div>
                  </div>
                ))}
              </div>

              {importResult.failedRows.length > 0 && (
                <div className="bg-white rounded-xl border border-error/20 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-error/5 border-b border-error/20">
                    <h3 className="font-bold text-sm text-error">Failed Rows</h3>
                    <button onClick={exportFailed} className="px-4 py-1.5 text-sm font-bold rounded-full bg-error/10 text-error hover:bg-error/20 transition-all">Export Failed</button>
                  </div>
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-light sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-text-secondary">Row</th>
                          <th className="px-3 py-2 text-left font-bold text-text-secondary">Name</th>
                          <th className="px-3 py-2 text-left font-bold text-text-secondary">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importResult.failedRows.map((row) => (
                          <tr key={row.rowNumber}>
                            <td className="px-3 py-2 text-text-secondary">{row.rowNumber}</td>
                            <td className="px-3 py-2 font-bold text-text-primary">{row.data.firstName || '—'} {row.data.lastName || ''}</td>
                            <td className="px-3 py-2 text-error">{row.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4 pt-4">
                <button onClick={() => navigate('/users')} className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:bg-brand-cyan transition-all">View Users →</button>
                <button onClick={() => window.location.reload()} className="px-6 py-3 font-bold rounded-full bg-white text-text-secondary border border-border hover:bg-surface-cream transition-all">Import More</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
