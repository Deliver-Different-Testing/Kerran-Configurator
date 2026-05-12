import { useMemo, useState } from 'react';
import type { ValidatedCourierRow } from '@/services/np_importService';

type FilterTab = 'all' | 'valid' | 'duplicate' | 'error';

interface Props {
  rows: ValidatedCourierRow[];
  selectedRows: Set<number>;
  onSelectionChange: (selected: Set<number>) => void;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; cls: string }> = {
  valid: { icon: '✅', label: 'Valid', cls: 'text-success bg-success/10' },
  duplicate: { icon: '⚠️', label: 'Duplicate', cls: 'text-warning bg-warning/10' },
  error: { icon: '❌', label: 'Error', cls: 'text-error bg-error/10' },
};

export default function ValidationResults({
  rows, selectedRows, onSelectionChange, validCount, duplicateCount, errorCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filtered = useMemo(() => {
    if (activeTab === 'all') return rows;
    return rows.filter((r) => r.status === activeTab);
  }, [rows, activeTab]);

  const toggle = (n: number) => {
    const next = new Set(selectedRows);
    next.has(n) ? next.delete(n) : next.add(n);
    onSelectionChange(next);
  };

  const selectAllValid = () =>
    onSelectionChange(new Set(rows.filter((r) => r.status === 'valid').map((r) => r.rowNumber)));
  const selectAll = () => onSelectionChange(new Set(rows.map((r) => r.rowNumber)));
  const deselectAll = () => onSelectionChange(new Set());

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'valid', label: 'Valid', count: validCount },
    { key: 'duplicate', label: 'Duplicates', count: duplicateCount },
    { key: 'error', label: 'Errors', count: errorCount },
  ];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Valid', value: validCount, icon: '✅' },
          { label: 'Duplicates', value: duplicateCount, icon: '⚠️' },
          { label: 'Errors', value: errorCount, icon: '❌' },
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
        <button onClick={selectAllValid} className="px-4 py-2 text-sm font-bold rounded-full bg-success/10 text-success hover:bg-success/20 transition-all">
          Select Valid
        </button>
        <button onClick={selectAll} className="px-4 py-2 text-sm font-bold rounded-full bg-surface-cream text-text-secondary hover:text-text-primary transition-all">
          Select All
        </button>
        <button onClick={deselectAll} className="px-4 py-2 text-sm font-bold rounded-full bg-surface-cream text-text-secondary hover:text-text-primary transition-all">
          Deselect All
        </button>
        <span className="ml-auto text-sm text-text-secondary self-center font-bold">
          {selectedRows.size} of {rows.length} selected
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-light rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === tab.key ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
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
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === rows.length && rows.length > 0}
                    onChange={() => (selectedRows.size === rows.length ? deselectAll() : selectAll())}
                  />
                </th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary w-12">#</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Status</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Name</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Phone</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Email</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => {
                const cfg = STATUS_CONFIG[row.status];
                return (
                  <tr key={row.rowNumber} className="hover:bg-surface-cream/50 transition-colors">
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedRows.has(row.rowNumber)} onChange={() => toggle(row.rowNumber)} />
                    </td>
                    <td className="px-3 py-3 text-text-secondary">{row.rowNumber}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${cfg.cls}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-bold text-text-primary">
                      {row.data.firstName || row.data['First Name'] || '—'}{' '}
                      {row.data.lastName || row.data['Last Name'] || ''}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">{row.data.phone || row.data.Phone || row.data.Mobile || '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{row.data.email || row.data.Email || '—'}</td>
                    <td className="px-3 py-3">
                      {row.status === 'error' && (
                        <span className="text-xs text-error">{row.errors.join('; ')}</span>
                      )}
                      {row.status === 'duplicate' && (
                        <span className="text-xs text-warning">Matches existing courier</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
