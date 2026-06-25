import { useMemo, useState } from 'react';
import type { ClientOption } from './types';

interface Props {
  clients: ClientOption[];
  allClients: boolean;
  selected: string[];
  onAllClientsChange: (value: boolean) => void;
  onSelectedChange: (codes: string[]) => void;
}

/**
 * Client-scope picker for a template: an "all clients" toggle plus a filterable multi-select checkbox
 * list of client codes. Shared by the upload page and the edit-details dialog.
 */
export default function ClientScopePicker({
  clients,
  allClients,
  selected,
  onAllClientsChange,
  onSelectedChange,
}: Props) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? clients.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(q)) : clients;
  }, [clients, filter]);

  const toggle = (code: string) =>
    onSelectedChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-secondary uppercase tracking-wide">Clients</label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allClients} onChange={(e) => onAllClientsChange(e.target.checked)} />
        Apply to <strong>all clients</strong>
      </label>
      {!allClients && (
        <div className="border border-border rounded-md">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter clients…"
            className="w-full border-b border-border px-3 py-2 text-sm rounded-t-md"
          />
          <div className="max-h-44 overflow-y-auto">
            {filtered.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-light cursor-pointer"
              >
                <input type="checkbox" checked={selected.includes(c.code)} onChange={() => toggle(c.code)} />
                <span>
                  {c.code} — {c.name}
                </span>
              </label>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">No matching clients.</p>}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-border px-3 py-1.5 text-xs text-text-secondary">
              {selected.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
