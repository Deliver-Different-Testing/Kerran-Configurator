import { useEffect, useRef, useState } from 'react';
import { courierDocumentsService, type CourierDocumentItem } from '@/services/courier_documentsService';
import { extractCourierError } from '@/services/courier_api';

// Courier Portal (finish-line P0) — My Documents. Lists the courier-applicable
// document types as a checklist; the courier uploads/replaces each (AI-vetted +
// staff-reviewed server-side) and sees their verify status + any reject reason
// so they know what to re-upload. Mirrors the applicant-side ApplicantDocuments.

function statusChip(status: string) {
  const map: Record<string, string> = {
    Verified: 'bg-success-bg text-success',
    Pending: 'bg-amber-50 text-amber-700',
    Rejected: 'bg-red-50 text-red-700',
    Missing: 'bg-surface-light text-text-muted',
  };
  const label =
    status === 'Missing' ? 'Not uploaded' : status === 'Pending' ? 'Under review' : status;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? map.Missing}`}>
      {label}
    </span>
  );
}

export default function CourierDocuments() {
  const [items, setItems] = useState<CourierDocumentItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyType, setBusyType] = useState<number | null>(null);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    let alive = true;
    courierDocumentsService.list()
      .then(d => { if (alive) setItems(d); })
      .catch(e => { if (alive) setError(extractCourierError(e, 'Could not load your documents.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function onFile(typeId: number, file: File | undefined) {
    if (!file) return;
    setBusyType(typeId); setError(null);
    try {
      const updated = await courierDocumentsService.upload(typeId, file);
      setItems(updated);
    } catch (e) {
      setError(extractCourierError(e, 'Upload failed. Please try again.'));
    } finally {
      setBusyType(null);
    }
  }

  if (loading) return <Card>Loading documents…</Card>;
  if (!items || items.length === 0) {
    return <Card><div className="text-sm text-text-muted">No documents are required for you right now.</div></Card>;
  }

  return (
    <Card>
      <h2 className="text-base font-bold text-text-primary mb-1">My Documents</h2>
      <p className="text-sm text-text-muted mb-4">
        Upload the documents below. We'll review each one — you'll see the status update here.
      </p>

      {error && <div className="text-sm text-red-700 mb-3">⚠️ {error}</div>}

      <div className="divide-y divide-border">
        {items.map(item => (
          <div key={item.documentTypeId} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary flex items-center gap-2 flex-wrap">
                {item.documentTypeName}
                {item.mandatory && (
                  <span className="text-[10px] px-1.5 rounded bg-red-50 text-red-600 border border-red-200 uppercase">
                    Required
                  </span>
                )}
                {statusChip(item.status)}
              </div>
              {item.instructions && <div className="text-xs text-text-muted mt-0.5">{item.instructions}</div>}
              {item.fileName && (
                <div className="text-xs text-text-secondary mt-0.5">
                  {item.fileName}
                  {item.documentId && (
                    <> · <a href={courierDocumentsService.downloadUrl(item.documentId)} target="_blank" rel="noreferrer" className="text-brand-cyan hover:underline">view</a></>
                  )}
                  {item.expiryDate && <> · expires {item.expiryDate}</>}
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

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white border border-border shadow-sm p-5">{children}</div>;
}
