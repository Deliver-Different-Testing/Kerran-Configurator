import { useEffect, useMemo, useState } from 'react';
import type { FieldMapping, FieldType, TextAlignment } from './types';
import { dataBindingGroups, isRepeatingBinding, type DataBinding } from './dataBindings';

// Field properties editor. Rebuilt from the pdf-overlay-tool AdminPortal MUI panel in Tailwind.
// The binding picker is a searchable, grouped combobox (restores the MUI Autocomplete's type-to-search
// over the ~370-entry catalog); free text is also accepted (Enter) since every binding is ultimately a
// path the consumer fills.

const fieldTypes: FieldType[] = ['text', 'multiline', 'date', 'image', 'barcode'];
const alignments: TextAlignment[] = ['left', 'center', 'right'];

const inputCls = 'rounded-md border border-border px-3 py-2 text-sm w-full';
const labelCls = 'text-xs text-text-secondary uppercase tracking-wide';

export default function FieldPropertiesPanel({
  field,
  onChange,
  onDelete,
  idError,
  bindingError,
}: {
  field: FieldMapping | null;
  onChange: (field: FieldMapping) => void;
  onDelete: (id: string) => void;
  idError?: string;
  bindingError?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Reset the binding search whenever the selected field changes.
  useEffect(() => {
    setQuery('');
    setOpen(false);
  }, [field?.id]);

  // Filter + group the catalog by the search query (matches group + label + path).
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, DataBinding[]>();
    for (const b of dataBindingGroups) {
      if (q && !`${b.group} ${b.label} ${b.value}`.toLowerCase().includes(q)) continue;
      const list = map.get(b.group) ?? [];
      list.push(b);
      map.set(b.group, list);
    }
    return [...map.entries()];
  }, [query]);

  if (!field) {
    return (
      <div className="p-4 text-sm text-text-secondary">
        Select a field on the page, or add one, to edit its properties.
      </div>
    );
  }

  const patch = (changes: Partial<FieldMapping>) => onChange({ ...field, ...changes });
  const isText = field.type !== 'image' && field.type !== 'barcode';
  const repeating = field.dataBinding ? isRepeatingBinding(field.dataBinding) : false;
  const selectedLabel = dataBindingGroups.find((b) => b.value === field.dataBinding)?.label ?? field.dataBinding ?? '';

  const choose = (value: string) => {
    patch({ dataBinding: value || undefined });
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Field</h3>
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={field.label ?? ''} onChange={(e) => patch({ label: e.target.value })} />
          <span className="text-xs text-text-muted">Identifies the field. The binding key is derived from it.</span>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={field.type} onChange={(e) => patch({ type: e.target.value as FieldType })}>
            {fieldTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Searchable, grouped binding combobox. */}
        <div className="flex flex-col gap-1 relative">
          <label className={labelCls}>Data binding</label>
          <input
            type="text"
            className={`${inputCls} ${bindingError ? 'border-red-400' : ''}`}
            placeholder="Search bindings…"
            value={open ? query : selectedLabel}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            // Allow a free-text path (Enter) for bindings not in the suggested catalog.
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) { e.preventDefault(); choose(query.trim()); } }}
            // Delay close so an option's mousedown registers first.
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {!open && field.dataBinding && (
            <span className="text-xs text-text-muted">
              {field.dataBinding}{repeating ? ' · ↻ repeats per record' : ''}
            </span>
          )}
          {bindingError && <span className="text-xs text-red-600">{bindingError}</span>}

          {open && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-72 overflow-auto bg-white border border-border rounded-md shadow-lg text-sm">
              {filteredGroups.length === 0 && <div className="px-3 py-2 text-text-muted">No matches</div>}
              {filteredGroups.map(([group, items]) => (
                <div key={group}>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-text-muted bg-surface-light sticky top-0">{group}</div>
                  {items.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      // mousedown (not click) so it fires before the input's blur closes the list.
                      onMouseDown={(e) => { e.preventDefault(); choose(b.value); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-brand-cyan/10 flex flex-col ${b.value === field.dataBinding ? 'bg-brand-cyan/10' : ''}`}
                    >
                      <span>{b.label}{isRepeatingBinding(b.value, b.group) ? ' ↻' : ''}</span>
                      <span className="text-[11px] text-text-muted">{b.value}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <details open={Boolean(idError)} className="border-t border-border pt-2">
          <summary className="text-xs text-text-secondary cursor-pointer">Advanced</summary>
          <div className="flex flex-col gap-1 mt-2">
            <label className={labelCls}>Binding key</label>
            <input
              className={`${inputCls} ${idError ? 'border-red-400' : ''}`}
              value={field.id}
              onChange={(e) => patch({ id: e.target.value })}
            />
            <span className={`text-xs ${idError ? 'text-red-600' : 'text-text-muted'}`}>
              {idError ?? 'What data is sent under at render time. Auto-derived from the Name — edit only if you need a specific key.'}
            </span>
          </div>
        </details>

        <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>X</label>
            <input type="number" className={inputCls} value={field.x} onChange={(e) => patch({ x: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Y</label>
            <input type="number" className={inputCls} value={field.y} onChange={(e) => patch({ y: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Width</label>
            <input type="number" className={inputCls} value={field.w} onChange={(e) => patch({ w: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Height</label>
            <input type="number" className={inputCls} value={field.h} onChange={(e) => patch({ h: Number(e.target.value) })} />
          </div>
        </div>

        {isText && (
          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Font size</label>
              <input type="number" className={inputCls} value={field.fontSize} onChange={(e) => patch({ fontSize: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Alignment</label>
              <select className={inputCls} value={field.alignment} onChange={(e) => patch({ alignment: e.target.value as TextAlignment })}>
                {alignments.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            {field.type === 'date' && (
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Date format</label>
                <input className={inputCls} placeholder="HH:mm" value={field.format ?? ''} onChange={(e) => patch({ format: e.target.value })} />
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onDelete(field.id)}
          className="w-full text-sm text-red-600 border border-red-200 rounded-md px-3 py-2 hover:bg-red-50"
        >
          Remove field
        </button>
      </div>
    </div>
  );
}
