import React, { useMemo, useState } from 'react';
import type { ValidatedRow } from '@/services/tenant_importService';
import { AssociationBadge } from '@/components/common/AssociationBadge';
import { StatCard } from '@/components/tenant/StatCard';

type FilterTab = 'all' | 'valid' | 'duplicate' | 'association_match' | 'error';

interface ValidationResultsProps {
  rows: ValidatedRow[];
  selectedRows: Set<number>;
  onSelectionChange: (selected: Set<number>) => void;
  duplicateCount: number;
  associationMatchCount: number;
  errorCount: number;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; className: string }> = {
  valid: { icon: '✅', label: 'Valid', className: 'text-success bg-success/10' },
  duplicate: { icon: '⚠️', label: 'Duplicate', className: 'text-warning bg-warning/10' },
  association_match: { icon: '🏅', label: 'Association Match', className: 'text-brand-cyan bg-brand-cyan/10' },
  error: { icon: '❌', label: 'Error', className: 'text-danger bg-danger/10' },
};

export function ValidationResults({
  rows,
  selectedRows,
  onSelectionChange,
  duplicateCount,
  associationMatchCount,
  errorCount,
}: ValidationResultsProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const validCount = rows.filter((r) => r.status === 'valid').length;

  const filtered = useMemo(() => {
    if (activeTab === 'all') return rows;
    return rows.filter((r) => r.status === activeTab);
  }, [rows, activeTab]);

  const toggleRow = (rowNumber: number) => {
    const next = new Set(selectedRows);
    if (next.has(rowNumber)) next.delete(rowNumber);
    else next.add(rowNumber);
    onSelectionChange(next);
  };

  const selectAllValid = () => {
    const valid = new Set(rows.filter((r) => r.status === 'valid' || r.status === 'association_match').map((r) => r.rowNumber));
    onSelectionChange(valid);
  };

  const selectAll = () => onSelectionChange(new Set(rows.map((r) => r.rowNumber)));
  const deselectAll = () => onSelectionChange(new Set());

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'valid', label: 'Valid', count: validCount },
    { key: 'duplicate', label: 'Duplicates', count: duplicateCount },
    { key: 'association_match', label: 'Matches', count: associationMatchCount },
    { key: 'error', label: 'Errors', count: errorCount },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Rows" value={rows.length} icon="📋" />
        <StatCard label="Valid" value={validCount} icon="✅" />
        <StatCard label="Duplicates" value={duplicateCount} icon="⚠️" />
        <StatCard label="Association Matches" value={associationMatchCount} icon="🏅" />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button onClick={selectAllValid} className="px-4 py-2 text-sm font-bold rounded-full bg-success/10 text-success hover:bg-success/20 transition-all">
          Select All Valid
        </button>
        <button onClick={selectAll} className="px-4 py-2 text-sm font-bold rounded-full bg-surface-light text-text-secondary hover:bg-border-light transition-all">
          Select All
        </button>
        <button onClick={deselectAll} className="px-4 py-2 text-sm font-bold rounded-full bg-surface-light text-text-secondary hover:bg-border-light transition-all">
          Deselect All
        </button>
        <span className="ml-auto text-sm text-text-muted self-center font-bold">
          {selectedRows.size} of {rows.length} selected
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface-light rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === tab.key ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Results table */}
      <div className="bg-white rounded-lg border-2 border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-light sticky top-0">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === rows.length && rows.length > 0}
                    onChange={() => (selectedRows.size === rows.length ? deselectAll() : selectAll())}
                    className="rounded border-border text-brand-cyan focus:ring-brand-cyan"
                  />
                </th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary w-12">#</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Status</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Name</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">City</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Phone</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Email</th>
                <th className="px-3 py-3 text-left font-bold text-text-secondary">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => {
                const cfg = STATUS_CONFIG[row.status];
                return (
                  <tr key={row.rowNumber} className="hover:bg-surface-light/50 transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.rowNumber)}
                        onChange={() => toggleRow(row.rowNumber)}
                        className="rounded border-border text-brand-cyan focus:ring-brand-cyan"
                      />
                    </td>
                    <td className="px-3 py-3 text-text-muted">{row.rowNumber}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${cfg.className}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-bold text-text-primary">{row.data.name || row.data.Name || '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{row.data.city || row.data.City || '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{row.data.phone || row.data.Phone || '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{row.data.email || row.data.Email || '—'}</td>
                    <td className="px-3 py-3">
                      {row.status === 'error' && (
                        <span className="text-xs text-danger">{row.errors.join('; ')}</span>
                      )}
                      {row.status === 'association_match' && row.associationMatch && (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <AssociationBadge association={row.associationMatch.association as any} />
                          <span className="text-text-muted">{row.associationMatch.companyName}</span>
                        </span>
                      )}
                      {row.status === 'duplicate' && (
                        <span className="text-xs text-warning">Matches existing agent</span>
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
