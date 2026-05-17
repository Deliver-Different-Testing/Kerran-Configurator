import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicQuotesService, type PublicInvite, type SubmitPublicQuotePayload } from '@/services/public_quotesService';

// Slice 2b — anonymous public response form for prospect-agent carriers.
// No login, no sidebar, just a branded standalone page that token-validates
// via the URL param, displays the posting headline + tenant message, and
// lets the prospect submit (or revise) their quote response.
//
// Reusable: the token stays valid while the quote is Requested/Submitted.
// Submit shows an inline green banner but keeps the form editable so the
// prospect can refine before the tenant Awards.

interface FormState {
  proposedRate: string;
  rateType: string;
  availableFleetSize: string;
  availableStartDate: string;
  message: string;
}

function emptyForm(): FormState {
  return {
    proposedRate: '',
    rateType: 'per-job',
    availableFleetSize: '',
    availableStartDate: '',
    message: '',
  };
}

function formFromInvite(inv: PublicInvite): FormState {
  return {
    proposedRate: inv.proposedRate?.toString() ?? '',
    rateType: inv.rateType ?? 'per-job',
    availableFleetSize: inv.availableFleetSize?.toString() ?? '',
    availableStartDate: inv.availableStartDate ?? '',
    message: inv.responseMessage ?? '',
  };
}

export default function QuoteResponse() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<PublicInvite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('Missing invitation token.');
      setLoading(false);
      return;
    }
    let alive = true;
    publicQuotesService.getInvite(token)
      .then(res => {
        if (!alive) return;
        const data = res.data;
        setInvite(data);
        setForm(formFromInvite(data));
      })
      .catch(err => {
        if (alive) setLoadError(extractError(err, 'Unable to load this invitation.'));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  async function handleSubmit() {
    if (!token || !invite) return;
    const rate = Number(form.proposedRate);
    if (!form.proposedRate || Number.isNaN(rate) || rate <= 0) {
      setSubmitError('Proposed rate is required and must be greater than zero.');
      return;
    }
    const payload: SubmitPublicQuotePayload = {
      proposedRate: rate,
      rateType: form.rateType || null,
      availableFleetSize: form.availableFleetSize === '' ? null : Number(form.availableFleetSize),
      availableStartDate: form.availableStartDate || null,
      message: form.message || null,
    };
    setSubmitting(true);
    setSubmitError(null);
    try {
      await publicQuotesService.submit(token, payload);
      setJustSubmitted(true);
      // Re-fetch to pick up the new Status='Submitted' on the row.
      const refreshed = await publicQuotesService.getInvite(token);
      setInvite(refreshed.data);
      setForm(formFromInvite(refreshed.data));
    } catch (err) {
      setSubmitError(extractError(err, 'Failed to submit your response.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // index.css forces `body { display:flex; overflow:hidden }` and
    // `#configurator-root { display:flex; width:100% }` — designed for the
    // authenticated AppLayout shell. We mirror that pattern: full-screen
    // flex column with a sticky header and a scrollable main area.
    <div className="w-full h-screen flex flex-col bg-[#fafbfc] overflow-hidden">
      <header className="bg-brand-dark py-4 px-6 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <img src="/dfrnt-logo.png" alt="DFRNT" className="w-8 h-8 object-contain" />
          <div>
            <div className="text-base font-bold text-white">DFRNT Drive</div>
            <div className="text-xs text-white/60 uppercase tracking-wider">Quotes Marketplace</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
        {loading && (
          <div className="rounded-lg bg-white border border-border p-6 text-sm text-text-muted">
            Loading invitation…
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-lg bg-white border border-red-200 p-8 text-center">
            <div className="text-base font-bold text-red-700 mb-2">⚠️ Unable to open this invitation</div>
            <div className="text-sm text-text-secondary">{loadError}</div>
            <div className="text-xs text-text-muted mt-4">
              If the tenant sent you this link recently, please double-check the URL or ask them to resend.
              Links expire 30 days after they're issued.
            </div>
          </div>
        )}

        {!loading && invite && (
          <div className="space-y-4">
            {/* Posting headline */}
            <div className="rounded-lg bg-white border border-border shadow-sm p-5">
              <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                You've been invited to quote
              </div>
              <h1 className="text-xl font-bold text-text-primary mb-2">{invite.postingTitle}</h1>
              <div className="text-sm text-text-secondary">
                {invite.region || '—'} · {invite.serviceType || 'Service TBD'}
                {' · '}
                {invite.volumePerWeek > 0 ? `${invite.volumePerWeek}/week` : 'Volume TBD'}
                {' · '}
                {invite.isOngoing
                  ? 'Ongoing'
                  : invite.startDate || invite.endDate
                    ? `${invite.startDate || '?'} → ${invite.endDate || '?'}`
                    : 'Dates TBD'}
              </div>
              {invite.description && (
                <p className="mt-3 text-sm text-text-secondary whitespace-pre-line">{invite.description}</p>
              )}
              {invite.tenantMessage && (
                <div className="mt-4 rounded-md bg-surface-light border-l-2 border-brand-cyan px-3 py-2 text-sm italic text-text-secondary">
                  "{invite.tenantMessage}"
                </div>
              )}
              {invite.prospectName && (
                <div className="mt-3 text-xs text-text-muted">
                  Invitation addressed to <span className="font-semibold text-text-primary">{invite.prospectName}</span>
                </div>
              )}
            </div>

            {/* Status banners */}
            {(justSubmitted || invite.status === 'Submitted') && !submitError && (
              <div className="rounded-md bg-success-bg border border-success/30 px-4 py-3 text-sm text-success">
                ✅ Your response has been submitted to the tenant. You can revise it below until they award the quote.
              </div>
            )}

            {/* Response form */}
            <div className="rounded-lg bg-white border border-border shadow-sm p-5">
              <div className="text-base font-bold text-text-primary mb-4">Your response</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">
                    Proposed Rate ($) <span className="text-error">*</span>
                  </label>
                  <input
                    type="number" step="0.01" min="0"
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
                    type="number" min="0"
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

              {submitError && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
                  ⚠️ {submitError}
                </div>
              )}

              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !form.proposedRate}
                  className="px-5 py-2 text-sm font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow disabled:opacity-50"
                >
                  {submitting
                    ? 'Submitting…'
                    : invite.status === 'Submitted' ? 'Update Response' : 'Submit Quote'}
                </button>
              </div>
            </div>

            <footer className="text-center text-xs text-text-muted py-4">
              You received this invitation because a tenant requested a quote from your business on DFRNT Drive.
            </footer>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

function extractError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { messages?: { message?: string }[] } } }).response?.data;
    const msg = data?.messages?.[0]?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return err instanceof Error ? err.message : fallback;
}
