import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ImportResult } from '@/services/tenant_importService';
import { StatCard } from '@/components/tenant/StatCard';

interface ImportProgressProps {
  isImporting: boolean;
  progress: number; // 0-100
  result: ImportResult | null;
}

export function ImportProgress({ isImporting, progress, result }: ImportProgressProps) {
  const navigate = useNavigate();

  const exportFailed = () => {
    if (!result?.failedRows.length) return;
    const headers = ['Row', 'Error', ...Object.keys(result.failedRows[0].data)];
    const csvRows = result.failedRows.map((r) => [
      r.rowNumber,
      `"${r.error.replace(/"/g, '""')}"`,
      ...Object.values(r.data).map((v) => `"${(v || '').replace(/"/g, '""')}"`),
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'failed_imports.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isImporting) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-16 h-16 border-4 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-xl font-bold text-text-primary">Importing Agents…</p>
          <p className="text-sm text-text-muted mt-1">Please don't close this page</p>
        </div>
        <div className="w-80">
          <div className="h-3 bg-surface-light rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-cyan rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-text-muted mt-2">{progress}%</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="text-center py-6">
        <span className="text-5xl">
          {result.failedCount === 0 ? '🎉' : result.successCount > 0 ? '⚡' : '😔'}
        </span>
        <h2 className="text-2xl font-bold text-text-primary mt-4">Import Complete</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Imported" value={result.successCount} icon="✅" />
        <StatCard label="Skipped" value={result.totalRows - result.successCount - result.failedCount} icon="⏭️" />
        <StatCard label="Failed" value={result.failedCount} icon="❌" />
      </div>

      {/* Failed rows */}
      {result.failedRows.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-danger/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-danger/5 border-b border-danger/20">
            <h3 className="font-bold text-sm text-danger">Failed Rows</h3>
            <button
              onClick={exportFailed}
              className="px-4 py-1.5 text-sm font-bold rounded-full bg-danger/10 text-danger hover:bg-danger/20 transition-all"
            >
              📥 Export Failed
            </button>
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
                {result.failedRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2 text-text-muted">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-bold">{row.data.name || '—'}</td>
                    <td className="px-3 py-2 text-danger">{row.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={() => navigate('/agents')}
          className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all"
        >
          View Imported Agents →
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 font-bold rounded-full bg-white text-text-secondary border-2 border-border hover:bg-surface-light transition-all"
        >
          Import More
        </button>
      </div>
    </div>
  );
}
