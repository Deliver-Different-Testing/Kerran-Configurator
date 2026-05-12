import { useEffect, useState } from 'react';
import { npQuotesService, type PendingInvite, type SubmitInvitePayload } from '@/services/np_quotesService';

// Carrier-side inbox of pending invitations. Each card lists the posting
// headline + tenant's message, and expands to a response form that
// transitions the quote Requested → Submitted via PUT /np/quotes/{id}/submit.
// Once submitted, the row disappears from this list (it's no longer
// Requested) and surfaces on the tenant side in the Quotes modal.

interface ResponseForm {
  proposedRate: string;
  rateType: string;
  availableFleetSize: string;
  availableStartDate: string;
  message: string;
}

const EMPTY_FORM: ResponseForm = {
  proposedRate: '',
  rateType: 'per-job',
  availableFleetSize: '',
  availableStartDate: '',
  message: '',
};

export default function NpQuotes() {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<ResponseForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    npQuotesService.listPending()
      .then(res => { if (alive) setInvites(res.data ?? []); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function openResponse(invite: PendingInvite) {
    setExpandedId(invite.quoteId);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function closeResponse() {
    setExpandedId(null);
    setError(null);
  }

  async function handleSubmit(quoteId: number) {
    const rate = Number(form.proposedRate);
    if (!form.proposedRate || Number.isNaN(rate) || rate <= 0) {
      setError('Proposed rate is required and must be greater than zero.');
      return;
    }

    const payload: SubmitInvitePayload = {
      proposedRate: rate,
      rateType: form.rateType || null,
      availableFleetSize: form.availableFleetSize === '' ? null : Number(form.availableFleetSize),
      availableStartDate: form.availableStartDate || null,
      message: form.message || null,
    };

    setSubmitting(true);
    setError(null);
    try {
      await npQuotesService.submit(quoteId, payload);
      // Optimistic remove — quote is no longer Requested so it drops off
      // the inbox list. The tenant-side Quotes modal will pick it up as
      // Submitted on next listQuotes call.
      setInvites(prev => prev.filter(i => i.quoteId !== quoteId));
      closeResponse();
    } catch (err) {
      setError(extractError(err, 'Failed to submit quote'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Quote Invites</h1>
        <p className="text-sm text-text-secondary mt-1">
          Coverage requests sent to you by tenants. Respond with your rate and availability to enter their quote comparison.
        </p>
      </header>

      {loading && (
        <div className="rounded-lg bg-white border border-border p-6 text-sm text-text-muted">
          Loading invites…
        </div>
      )}

      {!loading && invites.length === 0 && (
        <div className="rounded-lg bg-white border border-border p-10 text-center">
          <div className="text-sm font-medium text-text-primary mb-1">No pending invites</div>
          <div className="text-sm text-text-muted">
            You'll see new coverage requests here as tenants send them.
          </div>
        </div>
      )}

      <div className="space-y-3">
        {invites.map(invite => {
          const isExpanded = expandedId === invite.quoteId;
          return (
            <div
              key={invite.quoteId}
              className="rounded-lg bg-white border border-border shadow-sm overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-text-primary">{invite.postingTitle}</span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-badge-blue-bg text-badge-blue-text">
                        {invite.serviceType || 'Service'}
                      </span>
                      <span className="text-xs text-text-muted">
                        Invited {relativeDate(invite.requestedDate)}
                      </span>
                    </div>
                    <div className="text-sm text-text-secondary mt-1">
                      {invite.region || '—'} · {invite.volumePerWeek > 0 ? `${invite.volumePerWeek}/week` : 'Volume TBD'}
                      {' · '}
                      {invite.isOngoing
                        ? 'Ongoing'
                        : invite.startDate || invite.endDate
                          ? `${invite.startDate || '?'} → ${invite.endDate || '?'}`
                          : 'Dates TBD'}
                    </div>
                  </div>
                  {!isExpanded && (
                    <button
                      onClick={() => openResponse(invite)}
                      className="flex-shrink-0 px-4 py-2 text-sm font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all"
                    >
                      Respond
                    </button>
                  )}
                </div>

                {invite.description && (
                  <div className="text-sm text-text-secondary mt-2 mb-2 whitespace-pre-line">{invite.description}</div>
                )}

                {invite.tenantMessage && (
                  <div className="mt-2 rounded-md bg-surface-light border-l-2 border-brand-cyan px-3 py-2 text-sm italic text-text-secondary">
                    "{invite.tenantMessage}"
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-border-light bg-surface-light/50 p-4">
                  <div className="text-sm font-bold text-text-primary mb-3">Your response</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-text-secondary uppercase tracking-wide">Proposed Rate ($) <span className="text-error">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.proposedRate}
                        onChange={e => setForm(f => ({ ...f, proposedRate: e.target.value }))}
                        placeholder="e.g. 42.50"
                        className="rounded-md border border-border px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-text-secondary uppercase tracking-wide">Rate Type</label>
                      <select
                        value={form.rateType}
                        onChange={e => setForm(f => ({ ...f, rateType: e.target.value }))}
                        className="rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <option value="per-job">Per Job</option>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="flat">Flat Rate</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-text-secondary uppercase tracking-wide">Available Fleet Size</label>
                      <input
                        type="number"
                        min="0"
                        value={form.availableFleetSize}
                        onChange={e => setForm(f => ({ ...f, availableFleetSize: e.target.value }))}
                        placeholder="e.g. 5"
                        className="rounded-md border border-border px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-text-secondary uppercase tracking-wide">Available Start Date</label>
                      <input
                        type="date"
                        value={form.availableStartDate}
                        onChange={e => setForm(f => ({ ...f, availableStartDate: e.target.value }))}
                        className="rounded-md border border-border px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs text-text-secondary uppercase tracking-wide">Notes</label>
                      <textarea
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="Anything the tenant should know about your offer?"
                        rows={3}
                        className="rounded-md border border-border px-3 py-2 text-sm resize-none"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                      ⚠️ {error}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={closeResponse}
                      disabled={submitting}
                      className="px-4 py-2 text-sm font-bold rounded-full bg-white text-text-secondary border border-border hover:bg-surface-light disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSubmit(invite.quoteId)}
                      disabled={submitting || !form.proposedRate}
                      className="px-5 py-2 text-sm font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow disabled:opacity-50"
                    >
                      {submitting ? 'Submitting…' : 'Submit Quote'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Mirrors the relativeDate helper in QuoteRequests.tsx. Parses ISO 8601
// timestamps and buckets by *local* calendar day so "today / yesterday"
// matches the user's wall clock (not the UTC date stored in the DB).
function relativeDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.floor((todayMid - dMid) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function extractError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { messages?: { message?: string }[] } } }).response?.data;
    const msg = data?.messages?.[0]?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return err instanceof Error ? err.message : fallback;
}
