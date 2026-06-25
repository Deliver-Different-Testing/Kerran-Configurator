import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClients, listTemplates, setTemplateActive, updateTemplateDetails } from './service';
import type { ClientOption, TemplateSummary } from './types';
import ClientScopePicker from './ClientScopePicker';

// PDF Overlay tool — template library. Rebuilt from the pdf-overlay-tool AdminPortal (MUI) in
// configurator's Tailwind conventions. DF-Admin only.
export default function PdfOverlayTemplateList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit-details dialog state.
  const [editing, setEditing] = useState<TemplateSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editDocType, setEditDocType] = useState('');
  const [editAllClients, setEditAllClients] = useState(false);
  const [editClients, setEditClients] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listTemplates()
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load templates.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    listClients()
      .then(setClients)
      .catch(() => {
        /* non-fatal: the edit dialog's client list will just be empty */
      });
  }, []);

  const toggleActive = async (t: TemplateSummary) => {
    setBusyId(t.templateId);
    setError(null);
    try {
      await setTemplateActive(t.templateId, !t.isActive);
      setTemplates((prev) =>
        prev.map((x) => (x.templateId === t.templateId ? { ...x, isActive: !x.isActive } : x)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the template.');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (t: TemplateSummary) => {
    setEditing(t);
    setEditName(t.displayName);
    setEditDocType(t.documentType);
    setEditAllClients(t.allClients);
    setEditClients(t.clientIds);
    setError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim() || !editDocType.trim() || (!editAllClients && editClients.length === 0)) {
      setError('Display name, document type, and at least one client (or all clients) are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateTemplateDetails(editing.templateId, {
        displayName: editName.trim(),
        documentType: editDocType.trim(),
        clientIds: editAllClients ? [] : editClients,
        allClients: editAllClients,
      });
      setTemplates((prev) => prev.map((x) => (x.templateId === updated.templateId ? updated : x)));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the template details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold">PDF Overlay Templates</h2>
        <button
          onClick={() => navigate('/tools/pdf-overlay/new')}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow"
        >
          + New template
        </button>
      </div>
      <p className="text-sm text-text-secondary mb-5">
        Customer-supplied PDF templates and their field maps, scoped by document type and client. Open
        one to map where delivery data is stamped, or upload a new template.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-secondary uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Client(s)</th>
              <th className="px-4 py-3 font-semibold">Document type</th>
              <th className="px-4 py-3 font-semibold">Version</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {templates.map((t) => (
              <tr
                key={t.templateId}
                className="hover:bg-surface-light cursor-pointer"
                onClick={() => navigate(`/tools/pdf-overlay/${t.templateId}`)}
              >
                <td className="px-4 py-3 font-medium text-text-primary">{t.displayName}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {t.allClients ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">
                      All clients
                    </span>
                  ) : (
                    t.clientIds.join(', ')
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">{t.documentType}</td>
                <td className="px-4 py-3 text-text-secondary">v{t.currentVersion}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleActive(t)}
                    disabled={busyId === t.templateId}
                    className={`text-xs font-semibold px-2 py-1 rounded border disabled:opacity-50 ${
                      t.isActive
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-surface-light border-border text-text-muted'
                    }`}
                    aria-label={`${t.isActive ? 'deactivate' : 'activate'} ${t.displayName}`}
                  >
                    {t.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEdit(t)}
                    className="text-xs text-brand-cyan hover:underline mr-3"
                  >
                    Edit details
                  </button>
                  <button
                    onClick={() => navigate(`/tools/pdf-overlay/${t.templateId}`)}
                    className="text-xs text-brand-cyan hover:underline"
                  >
                    Edit fields
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(loading || templates.length === 0) && (
          <div className="text-center py-10 text-text-muted">
            {loading ? (
              <p className="text-sm">Loading…</p>
            ) : (
              <>
                <p className="text-sm mb-3">No templates yet.</p>
                <button
                  onClick={() => navigate('/tools/pdf-overlay/new')}
                  className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow"
                >
                  + New template
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !saving && setEditing(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Edit template details</h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Display name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Document type</label>
              <input
                value={editDocType}
                onChange={(e) => setEditDocType(e.target.value)}
                placeholder="e.g. ProofOfDelivery, PickupAlert"
                className="rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>

            <ClientScopePicker
              clients={clients}
              allClients={editAllClients}
              selected={editClients}
              onAllClientsChange={setEditAllClients}
              onSelectedChange={setEditClients}
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
