import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTemplates, setTemplateActive } from './service';
import type { TemplateSummary } from './types';

// PDF Overlay tool — template library. Rebuilt from the pdf-overlay-tool AdminPortal (MUI) in
// configurator's Tailwind conventions. DF-Admin only.
export default function PdfOverlayTemplateList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listTemplates()
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load templates.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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
        Customer-supplied PDF templates and their field maps, scoped by document type. Open one to map
        where delivery data is stamped, or upload a new template.
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
              <th className="px-4 py-3 font-semibold">Client</th>
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
                <td className="px-4 py-3 text-text-secondary">{t.clientId}</td>
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
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}
