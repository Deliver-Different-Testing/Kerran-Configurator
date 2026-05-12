import { useState } from 'react';
import { mockSubcontractors, type Subcontractor } from '@/services/portal_mockData';

export default function PortalContractors() {
  const [selected, setSelected] = useState<Subcontractor | null>(null);

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="text-sm text-brand-cyan">← Back</button>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-brand-cyan/20 flex items-center justify-center text-lg font-bold text-brand-cyan">
              {selected.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div className="font-bold">{selected.name}</div>
              <div className="text-xs text-text-muted">{selected.code} · {selected.phone}</div>
            </div>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${
              selected.status === 'Active' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
            }`}>{selected.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-light rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{selected.runsCompleted}</div>
              <div className="text-[10px] text-text-muted">Runs Completed</div>
            </div>
            <div className="bg-surface-light rounded-lg p-3 text-center">
              <div className="text-xl font-bold">${selected.totalEarnings.toLocaleString()}</div>
              <div className="text-[10px] text-text-muted">Total Earnings</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-sm">Subcontractors</h2>
      {mockSubcontractors.map(sc => (
        <button
          key={sc.id}
          onClick={() => setSelected(sc)}
          className="w-full bg-white rounded-xl border border-border p-3 flex items-center gap-3 text-left hover:border-brand-cyan transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-brand-cyan/20 flex items-center justify-center text-sm font-bold text-brand-cyan">
            {sc.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{sc.name}</div>
            <div className="text-xs text-text-muted">{sc.code} · {sc.runsCompleted} runs</div>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
            sc.status === 'Active' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
          }`}>{sc.status}</span>
        </button>
      ))}
    </div>
  );
}
