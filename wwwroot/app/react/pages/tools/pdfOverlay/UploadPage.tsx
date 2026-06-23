import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClients, uploadTemplate } from './service';
import type { ClientOption } from './types';

// PDF Overlay tool — upload a new template, then go straight to the field mapper.
export default function PdfOverlayUpload() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [clientCode, setClientCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch(() => setError('Could not load the client list.'));
  }, []);

  const canSubmit = useMemo(
    () => Boolean(file && clientCode && displayName.trim() && documentType.trim()) && !busy,
    [file, clientCode, displayName, documentType, busy],
  );

  const submit = async () => {
    if (!file || !clientCode) return;
    setBusy(true);
    setError(null);
    try {
      // The client's code is the stable, human-readable id templates are keyed by in storage.
      const summary = await uploadTemplate({
        file,
        clientId: clientCode,
        displayName: displayName.trim(),
        documentType: documentType.trim(),
      });
      navigate(`/tools/pdf-overlay/${summary.templateId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Make sure the file is an unencrypted PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold">New PDF Overlay Template</h2>
        <button
          onClick={() => navigate('/tools/pdf-overlay')}
          className="text-sm text-brand-cyan hover:underline"
        >
          ← Back to Templates
        </button>
      </div>
      <p className="text-sm text-text-secondary mb-5">
        Upload a client-supplied PDF. After upload you'll map the data fields onto it in the editor.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-white border border-border rounded-lg p-5 space-y-4">
        <label
          className={`flex items-center gap-2 justify-start border-2 border-dashed rounded-md px-4 py-4 text-sm cursor-pointer ${
            file ? 'border-green-300 bg-green-50 text-text-primary' : 'border-border text-text-secondary'
          }`}
        >
          <span>{file ? `✓ ${file.name}` : '⬆ Choose PDF…'}</span>
          <input
            hidden
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">Client</label>
          <select
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Bluebird Pickup Alert (NJ)"
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">Document type</label>
          <input
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            placeholder="e.g. PickupAlert, BillOfLading"
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
          <span className="text-xs text-text-muted">A label that scopes/groups the template (free text).</span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => navigate('/tools/pdf-overlay')}
            className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50"
          >
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
