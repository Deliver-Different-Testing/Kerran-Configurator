import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { courierRunsService, type CourierRun, type CourierJob } from '@/services/courier_runsService';
import { extractCourierError } from '@/services/courier_api';

// Phase 2 — Run detail. Job list with addresses, status, payment, a per-stop
// "Open in Maps" link (lat/lng or address), and a per-job enquiry to dispatch.
// (Embedded map is deferred; per-stop map links cover the "keep map" requirement
// for v1 — logged in memory.)

function addressOf(j: CourierJob): string {
  return [j.deliveryAddressLine1, j.deliveryAddressLine2, j.deliveryAddressLine3, j.deliveryAddressLine4,
    j.deliveryAddressLine5, j.deliveryAddressLine6].filter(Boolean).join(', ');
}
function mapUrl(j: CourierJob): string {
  if (j.deliveryLatitude != null && j.deliveryLongitude != null)
    return `https://www.google.com/maps?q=${j.deliveryLatitude},${j.deliveryLongitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOf(j))}`;
}

export default function CourierRunDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const bookDate = params.get('bookDate') ?? '';
  const runName = params.get('runName') ?? '';

  const [run, setRun] = useState<CourierRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-job enquiry state
  const [enquiryFor, setEnquiryFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    courierRunsService.detail(bookDate, runName)
      .then(d => { if (alive) setRun(d); })
      .catch(e => { if (alive) setError(extractCourierError(e, 'Could not load this run.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [bookDate, runName]);

  async function sendEnquiry(jobNumber: string) {
    if (!message.trim()) return;
    setSending(true);
    try {
      await courierRunsService.enquiry(jobNumber, message.trim());
      setSent(jobNumber); setEnquiryFor(null); setMessage('');
    } catch (e) {
      setError(extractCourierError(e, 'Could not send your enquiry.'));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Card>Loading…</Card>;
  if (error && !run) return <Card><div className="text-sm text-red-700">⚠️ {error}</div></Card>;
  if (!run) return null;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('..')} className="text-sm text-text-muted hover:underline">← All runs</button>

      <Card>
        <h1 className="text-xl font-bold text-text-primary">{run.dateDisplay} · {run.runName}</h1>
        <div className="text-sm text-text-muted mt-1">
          {run.jobs.length} stops · ${run.amount.toFixed(2)}
          {run.kms ? ` · ${run.kms} km` : ''}{run.time ? ` · ${run.time} min` : ''}
        </div>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">⚠️ {error}</div>}

      {run.jobs.map(j => (
        <div key={j.jobId} className={`rounded-lg bg-white border border-border shadow-sm p-4 ${j.void ? 'opacity-50' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-text-primary">{j.jobNumber} · {j.clientCode}</div>
              <div className="text-xs text-text-secondary mt-0.5">{addressOf(j) || '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-text-primary">${(j.courierPayment + j.courierFuel + j.courierBonus).toFixed(2)}</div>
              <div className="text-[11px] text-text-muted">{j.status}</div>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <a href={mapUrl(j)} target="_blank" rel="noreferrer" className="text-xs text-brand-cyan hover:underline">Open in Maps</a>
            <button onClick={() => { setEnquiryFor(enquiryFor === j.jobNumber ? null : j.jobNumber); setMessage(''); setSent(null); }} className="text-xs text-brand-cyan hover:underline">
              {enquiryFor === j.jobNumber ? 'Cancel' : 'Enquire'}
            </button>
            {sent === j.jobNumber && <span className="text-xs text-success">✅ Enquiry sent</span>}
          </div>
          {enquiryFor === j.jobNumber && (
            <div className="mt-2">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={2}
                placeholder="What would you like to ask dispatch about this job?"
                className="w-full rounded-md border border-border px-3 py-2 text-sm resize-none"
              />
              <div className="flex justify-end mt-1">
                <button
                  onClick={() => sendEnquiry(j.jobNumber)}
                  disabled={sending || !message.trim()}
                  className="px-4 py-1.5 text-sm font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow disabled:opacity-50"
                >
                  {sending ? 'Sending…' : 'Send enquiry'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white border border-border shadow-sm p-5">{children}</div>;
}
