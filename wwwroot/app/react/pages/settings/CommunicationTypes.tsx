import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { communicationTypeService, type CommunicationType } from '@/services/np_communicationTypeService';

// Courier modal §14 — manage the tucEventType catalogue. Focused on the 'CE'
// (Courier Event) group that powers the §13 Communications Type dropdown, but
// the Group field lets you place a type in any group. Add / Edit only —
// "deactivate" is deferred (tucEventType has no Active column).

const GROUPS = ['CE', 'WF', 'SE', 'CS', 'OE'];

const GROUP_LABEL: Record<string, string> = {
  CE: 'CE — Courier Event',
  WF: 'WF — Workflow',
  SE: 'SE — Service Event',
  CS: 'CS — Courier Support',
  OE: 'OE — Other Event',
};

export default function CommunicationTypes() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CommunicationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Editor: null = closed, 'new' = add, number = editing that id.
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<{ name: string; group: string }>({ name: '', group: 'CE' });

  const load = () => {
    setLoading(true);
    communicationTypeService.list('CE')
      .then(setItems)
      .catch(() => setError('Could not load communication types.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startAdd = () => { setForm({ name: '', group: 'CE' }); setEditing('new'); setError(null); };
  const startEdit = (t: CommunicationType) => { setForm({ name: t.name, group: t.group }); setEditing(t.id); setError(null); };
  const cancel = () => { setEditing(null); setError(null); };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setBusy(true); setError(null);
    try {
      if (editing === 'new') await communicationTypeService.create(form.name.trim(), form.group);
      else if (typeof editing === 'number') await communicationTypeService.update(editing, form.name.trim(), form.group);
      setEditing(null);
      load();
    } catch (e) {
      const msg = (e as { response?: { data?: { messages?: { message?: string }[] } } })?.response?.data?.messages?.[0]?.message;
      setError(msg || 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold">Communication Types</h2>
        <button onClick={() => navigate('/settings')} className="text-sm text-brand-cyan hover:underline">← Back to Settings</button>
      </div>
      <p className="text-sm text-text-secondary mb-5">
        The courier-communication types (Group <strong>CE</strong>) shown in the courier modal's Communications tab. Tenant-editable.
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm mb-4">⚠️ {error}</div>}

      <div className="bg-white border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Courier Event Types</h3>
          {editing === null && (
            <button onClick={startAdd} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow">
              + Add Type
            </button>
          )}
        </div>

        {editing === 'new' && <Editor form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} />}

        {loading ? (
          <div className="text-sm text-text-muted py-4">Loading…</div>
        ) : items.length === 0 && editing !== 'new' ? (
          <div className="text-sm text-text-muted py-4">No communication types yet. Add one to populate the Communications dropdown.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(t => (
              editing === t.id ? (
                <div key={t.id} className="py-2"><Editor form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} /></div>
              ) : (
                <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium text-text-primary">{t.name}</span>
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-text-muted border border-border uppercase">{t.group}</span>
                  </div>
                  <button onClick={() => startEdit(t)} className="text-xs text-brand-cyan hover:underline shrink-0">Edit</button>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Editor({
  form, setForm, onSave, onCancel, busy,
}: {
  form: { name: string; group: string };
  setForm: (f: { name: string; group: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="bg-surface-light border border-border rounded-lg p-4 mb-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">Name</label>
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Late Start"
            className="rounded-md border border-border px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">Group</label>
          <select
            value={form.group}
            onChange={e => setForm({ ...form, group: e.target.value })}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            {GROUPS.map(g => <option key={g} value={g}>{GROUP_LABEL[g] ?? g}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} disabled={busy} className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-50">Cancel</button>
        <button onClick={onSave} disabled={busy} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}
