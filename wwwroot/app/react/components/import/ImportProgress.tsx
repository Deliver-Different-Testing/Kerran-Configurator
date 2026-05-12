import { useNavigate } from 'react-router-dom';
import type { CourierImportResult } from '@/services/np_importService';

interface Props {
  isImporting: boolean;
  progress: number;
  result: CourierImportResult | null;
}

export default function ImportProgress({ isImporting, progress, result }: Props) {
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
    a.download = 'failed_courier_imports.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isImporting) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🚚</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-text-primary">Importing Couriers…</p>
          <p className="text-sm text-text-secondary mt-1">Please don't close this page</p>
        </div>
        <div className="w-80">
          <div className="h-3 bg-surface-light rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-cyan rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-text-secondary mt-2">{Math.round(progress)}%</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <span className="text-5xl">
          {result.failedCount === 0 ? '🎉' : result.successCount > 0 ? '⚡' : '😔'}
        </span>
        <h2 className="text-2xl font-bold text-text-primary mt-4">Import Complete</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Imported', value: result.successCount, icon: '✅' },
          { label: 'Skipped', value: result.totalRows - result.successCount - result.failedCount, icon: '⏭️' },
          { label: 'Failed', value: result.failedCount, icon: '❌' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-border text-center">
            <span className="text-2xl">{s.icon}</span>
            <div className="text-2xl font-bold text-text-primary mt-1">{s.value}</div>
            <div className="text-xs text-text-secondary">{s.label}</div>
          </div>
        ))}
      </div>

      {result.failedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-error/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-error/5 border-b border-error/20">
            <h3 className="font-bold text-sm text-error">Failed Rows</h3>
            <button onClick={exportFailed} className="px-4 py-1.5 text-sm font-bold rounded-full bg-error/10 text-error hover:bg-error/20 transition-all">
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
                    <td className="px-3 py-2 text-text-secondary">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-bold text-text-primary">
                      {row.data.firstName || '—'} {row.data.lastName || ''}
                    </td>
                    <td className="px-3 py-2 text-error">{row.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={() => navigate('/fleet')}
          className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-black hover:bg-brand-cyan transition-all"
        >
          View Fleet →
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 font-bold rounded-full bg-white text-text-secondary border border-border hover:bg-surface-cream transition-all"
        >
          Import More
        </button>
      </div>
    </div>
  );
}
