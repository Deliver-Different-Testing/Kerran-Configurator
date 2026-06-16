import { useEffect, useRef, useState } from 'react';
import { portalDocumentService, type PortalDocumentItem } from '@/services/portal_documentService';
import { extractPortalError } from '@/services/applicant_api';
import { Card, ErrorBanner } from './ui';

// Courier Portal P3 (Slice B) — applicant document upload step. Lists the
// required document types and lets the applicant upload each (AI-vetted +
// staff-reviewed server-side). Shows the applicant their verify status + any
// reject reason so they know what to re-upload.

function statusChip(status: string) {
  const map: Record<string, string> = {
    Verified: 'bg-success-bg text-success',
    Pending: 'bg-amber-50 text-amber-700',
    Rejected: 'bg-red-50 text-red-700',
    Missing: 'bg-surface-light text-text-muted',
  };
  const label = status === 'Missing' ? 'Not uploaded' : status === 'Pending' ? 'Under review' : status;
  return <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? map.Missing}`}>{label}</span>;
}

export default function ApplicantDocuments() {
  const [items, setItems] = useState<PortalDocumentItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyType, setBusyType] = useState<number | null>(null);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    let alive = true;
    portalDocumentService.list()
      .then(d => { if (alive) setItems(d); })
      .catch(e => { if (alive) setError(extractPortalError(e, 'Could not load your documents.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function onFile(typeId: number, file: File | undefined) {
    if (!file) return;
    setBusyType(typeId); setError(null);
    try {
      const updated = await portalDocumentService.upload(typeId, file);
      setItems(updated);
    } catch (e) {
      setError(extractPortalError(e, 'Upload failed. Please try again.'));
    } finally {
      setBusyType(null);
    }
  }

  if (loading) return <Card>Loading documents…</Card>;
  if (!items || items.length === 0) {
    return <Card><div className="text-sm text-text-muted">No documents are required at this stage.</div></Card>;
  }

  return (
    <Card>
      <h2 className="text-base font-bold text-text-primary mb-1">Documents</h2>
      <p className="text-sm text-text-muted mb-4">Upload the documents below. We'll review each one — you'll see the status update here.</p>

      {error && <ErrorBanner message={error} />}

      <div className="divide-y divide-border">
        {items.map(item => (
          <div key={item.documentTypeId} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary flex items-center gap-2 flex-wrap">
                {item.documentTypeName}
                {item.mandatory && <span className="text-[10px] px-1.5 rounded bg-red-50 text-red-600 border border-red-200 uppercase">Required</span>}
                {statusChip(item.status)}
              </div>
              {item.instructions && <div className="text-xs text-text-muted mt-0.5">{item.instructions}</div>}
              {item.fileName && (
                <div className="text-xs text-text-secondary mt-0.5">
                  {item.fileName}
                  {item.documentId && (
                    <> · <a href={portalDocumentService.downloadUrl(item.documentId)} target="_blank" rel="noreferrer" className="text-brand-cyan hover:underline">view</a></>
                  )}
                </div>
              )}
              {item.status === 'Rejected' && item.rejectReason && (
                <div className="text-xs text-red-700 mt-0.5">Rejected: {item.rejectReason} — please upload a new copy.</div>
              )}
            </div>

            <div className="shrink-0">
              <input
                ref={el => { inputs.current[item.documentTypeId] = el; }}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={e => onFile(item.documentTypeId, e.target.files?.[0] ?? undefined)}
              />
              <button
                onClick={() => inputs.current[item.documentTypeId]?.click()}
                disabled={busyType === item.documentTypeId}
                className="text-xs bg-brand-cyan text-brand-dark px-3 py-1.5 rounded-md font-medium hover:shadow-cyan-glow disabled:opacity-50"
              >
                {busyType === item.documentTypeId ? 'Uploading…' : item.status === 'Missing' ? 'Upload' : 'Replace'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
