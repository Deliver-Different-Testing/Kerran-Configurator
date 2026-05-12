import React, { useEffect, useState } from 'react';
import { DataTable } from '@/components/tenant/DataTable';
import { StatusBadge } from '@/components/tenant/StatusBadge';
import { Modal } from '@/components/tenant/Modal';
import { FormField } from '@/components/tenant/FormField';
import { AssociationBadge } from '@/components/common/AssociationBadge';
import { quotesService } from '@/services/tenant_quotesService';
import { agentService } from '@/services/tenant_agentService';
import type { QuotesPosting, Quote, Column, Agent } from '@/types';

interface CreateForm {
  title: string;
  region: string;
  serviceType: string;
  volumePerWeek: string;
  startDate: string;
  endDate: string;
}

const EMPTY_CREATE_FORM: CreateForm = {
  title: '',
  region: '',
  serviceType: 'Same Day',
  volumePerWeek: '',
  startDate: '',
  endDate: '',
};

export function QuoteRequests() {
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedPosting, setSelectedPosting] = useState<QuotesPosting | null>(null);
  const [postings, setPostings] = useState<QuotesPosting[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  function refetchPostings() {
    return quotesService.listPostings().then(res => setPostings(res.data ?? []));
  }

  useEffect(() => {
    let alive = true;
    quotesService.listPostings()
      .then(res => { if (alive) setPostings(res.data ?? []); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function openCreate() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError(null);
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setCreateError(null);
  }

  async function handleCreate() {
    if (!createForm.title.trim()) {
      setCreateError('Title is required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await quotesService.createPosting({
        title: createForm.title.trim(),
        region: createForm.region.trim(),
        serviceType: createForm.serviceType,
        volumePerWeek: createForm.volumePerWeek === '' ? 0 : Number(createForm.volumePerWeek),
        startDate: createForm.startDate || null,
        endDate: createForm.endDate || null,
      });
      await refetchPostings();
      closeCreate();
    } catch (err) {
      setCreateError(extractError(err, 'Failed to create posting'));
    } finally {
      setCreating(false);
    }
  }

  // Lazy-load quotes when a posting is opened.
  useEffect(() => {
    if (!selectedPosting) {
      setQuotes([]);
      return;
    }
    let alive = true;
    setLoadingQuotes(true);
    quotesService.listQuotes(selectedPosting.id)
      .then(res => { if (alive) setQuotes(res.data ?? []); })
      .finally(() => { if (alive) setLoadingQuotes(false); });
    return () => { alive = false; };
  }, [selectedPosting]);

  // Invite-to-quote — list of agents loaded once when the modal opens.
  const [agents, setAgents] = useState<Agent[]>([]);
  const [inviteAgentId, setInviteAgentId] = useState<number | ''>('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Award flow.
  const [awardingId, setAwardingId] = useState<number | null>(null);
  const [awardError, setAwardError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPosting) {
      setInviteAgentId('');
      setInviteMessage('');
      setInviteError(null);
      setAwardError(null);
      return;
    }
    if (agents.length === 0) {
      agentService.list().then(res => setAgents(res.data ?? []));
    }
  }, [selectedPosting]);

  async function handleInvite() {
    if (!selectedPosting || !inviteAgentId) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await quotesService.sendQuoteRequest({
        postingId: selectedPosting.id,
        agentId: Number(inviteAgentId),
        message: inviteMessage || null,
      });
      setQuotes(res.data ?? []);
      setInviteAgentId('');
      setInviteMessage('');
      // Refresh postings so the quoteCount column updates.
      refetchPostings();
    } catch (err) {
      setInviteError(extractError(err, 'Failed to send invite'));
    } finally {
      setInviting(false);
    }
  }

  async function handleAward(quoteId: number) {
    if (!selectedPosting) return;
    setAwardingId(quoteId);
    setAwardError(null);
    try {
      const res = await quotesService.award(quoteId);
      setQuotes(res.data ?? []);
      // Refresh postings so the parent table picks up the Awarded status.
      const refreshed = await quotesService.listPostings();
      const fresh = refreshed.data ?? [];
      setPostings(fresh);
      // Keep the modal open with the now-Awarded posting so the user can see
      // the outcome (Accepted / Declined chips) before closing.
      const updated = fresh.find(p => p.id === selectedPosting.id);
      if (updated) setSelectedPosting(updated);
    } catch (err) {
      setAwardError(extractError(err, 'Failed to award quote'));
    } finally {
      setAwardingId(null);
    }
  }

  const columns: Column<QuotesPosting>[] = [
    { key: 'title', header: 'Posting', sortable: true, render: (r) => <span className="font-bold text-text-primary">{r.title}</span> },
    { key: 'region', header: 'Region', sortable: true },
    { key: 'serviceType', header: 'Service' },
    { key: 'volumePerWeek', header: 'Vol/Week', sortable: true, render: (r) => <span className="font-bold">{r.volumePerWeek}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'quoteCount', header: 'Quotes',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedPosting(r); }}
          className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 transition-colors"
        >
          {r.quoteCount} quotes
        </button>
      ),
    },
    { key: 'createdDate', header: 'Created', render: (r) => <span className="text-text-muted">{r.createdDate}</span> },
  ];

  return (
    <div>
      {/* Header action */}
      <div className="flex justify-end mb-6">
        <button
          onClick={openCreate}
          className="px-5 py-2.5 font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all text-sm"
        >
          + New Quote Request
        </button>
      </div>

      {/* Postings table */}
      <div className="bg-white rounded-lg shadow-sm">
        <DataTable
          columns={columns}
          data={postings}
          keyField="id"
          onRowClick={(row) => setSelectedPosting(row)}
          emptyMessage={loading ? 'Loading…' : 'No postings yet'}
        />
      </div>

      {/* Create Posting Modal */}
      <Modal
        isOpen={showCreate}
        onClose={closeCreate}
        title="New Quote Request"
        footer={
          <>
            <button
              onClick={closeCreate}
              disabled={creating}
              className="px-5 py-2.5 font-bold rounded-full bg-white text-text-secondary border-2 border-border hover:bg-surface-light transition-all text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !createForm.title.trim()}
              className="px-5 py-2.5 font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all text-sm disabled:opacity-50"
            >
              {creating ? 'Posting…' : 'Post to Quotes'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <FormField
            label="Title"
            placeholder="e.g. Dallas Same-Day Coverage"
            required
            value={createForm.title}
            onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
          />
          <FormField
            label="Region"
            placeholder="e.g. Dallas"
            required
            value={createForm.region}
            onChange={(e) => setCreateForm(f => ({ ...f, region: e.target.value }))}
          />
          <FormField
            label="Service Type"
            options={[
              { value: 'Same Day', label: 'Same Day' },
              { value: 'Next Day', label: 'Next Day' },
              { value: 'Scheduled', label: 'Scheduled' },
              { value: 'Overnight', label: 'Overnight' },
            ]}
            value={createForm.serviceType}
            onChange={(e) => setCreateForm(f => ({ ...f, serviceType: e.target.value }))}
          />
          <FormField
            label="Volume per Week"
            type="number"
            placeholder="e.g. 200"
            value={createForm.volumePerWeek}
            onChange={(e) => setCreateForm(f => ({ ...f, volumePerWeek: e.target.value }))}
          />
          <FormField
            label="Start Date"
            type="date"
            value={createForm.startDate}
            onChange={(e) => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
          />
          <FormField
            label="End Date"
            type="date"
            value={createForm.endDate}
            onChange={(e) => setCreateForm(f => ({ ...f, endDate: e.target.value }))}
          />
        </div>
        {createError && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            ⚠️ {createError}
          </div>
        )}
      </Modal>

      {/* Quote Comparison Modal */}
      <Modal
        isOpen={!!selectedPosting}
        onClose={() => setSelectedPosting(null)}
        title={selectedPosting ? `Quotes: ${selectedPosting.title}` : ''}
        size="lg"
      >
        {selectedPosting && (
          <div>
            <div className="mb-4 p-4 bg-surface-light rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">Region:</span>{' '}
                  <span className="font-bold">{selectedPosting.region}</span>
                </div>
                <div>
                  <span className="text-text-muted">Service:</span>{' '}
                  <span className="font-bold">{selectedPosting.serviceType}</span>
                </div>
                <div>
                  <span className="text-text-muted">Volume:</span>{' '}
                  <span className="font-bold">{selectedPosting.volumePerWeek}/week</span>
                </div>
              </div>
            </div>

            {/* Invite-to-quote */}
            <div className="mb-4 rounded-lg border border-border bg-white p-4">
              <div className="mb-2 text-sm font-bold text-text-primary">Invite a carrier to quote</div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Agent</label>
                  <select
                    value={inviteAgentId}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setInviteAgentId(raw === '' ? '' : Number(raw));
                    }}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <option value="">— Select agent —</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}{a.city ? ` (${a.city})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Message (optional)</label>
                  <input
                    type="text"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="e.g. Are you able to cover this?"
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteAgentId}
                  className="rounded-md bg-brand-cyan px-4 py-2 text-sm font-bold text-brand-dark hover:shadow-cyan-glow disabled:opacity-50"
                >
                  {inviting ? 'Sending…' : 'Invite to Quote'}
                </button>
              </div>
              {inviteError && (
                <div className="mt-2 text-xs text-red-700">⚠️ {inviteError}</div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loadingQuotes && <div className="text-sm text-text-muted">Loading quotes…</div>}
              {!loadingQuotes && quotes.length === 0 && (
                <div className="text-sm text-text-muted">No quotes submitted for this posting yet.</div>
              )}
              {awardError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  ⚠️ {awardError}
                </div>
              )}
              {[...quotes]
                .sort((a, b) => a.pricePerJob - b.pricePerJob)
                .map((quote, idx) => {
                  const postingAwarded = selectedPosting.status === 'Awarded' || selectedPosting.status === 'Closed';
                  const canAward = !postingAwarded && (quote.status === 'Requested' || quote.status === 'Submitted');
                  const isMuted = quote.status === 'Declined' || quote.status === 'Expired';
                  const stateLabel = quoteStateLabel(quote);
                  return (
                    <div
                      key={quote.id}
                      className={`p-4 rounded-lg border-2 ${
                        quote.status === 'Accepted'
                          ? 'border-success bg-success/5'
                          : isMuted
                          ? 'border-border-light bg-surface-light/40 opacity-75'
                          : idx === 0
                          ? 'border-brand-cyan bg-brand-cyan/5'
                          : 'border-border-light'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-text-primary">{quote.agentName}</span>
                            <AssociationBadge association={quote.association} />
                            <QuoteStatusChip status={quote.status} />
                            {stateLabel && (
                              <span className="text-xs text-text-muted">{stateLabel}</span>
                            )}
                            {idx === 0 && !postingAwarded && !isMuted && (
                              <span className="px-2 py-0.5 text-xs font-normal rounded-full bg-success-bg text-success">
                                Best Price
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-text-secondary mb-2">{quote.notes}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {quote.coverageAreas.map((area) => (
                              <span key={area} className="px-2 py-0.5 text-xs font-normal rounded-full bg-badge-blue-bg text-badge-blue-text">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl font-bold text-text-primary">${quote.pricePerJob.toFixed(2)}</div>
                          <div className="text-xs text-text-muted">per job</div>
                          <div className="text-xs text-text-secondary mt-1">⏱️ {quote.leadTime}</div>
                          {canAward && (
                            <button
                              onClick={() => handleAward(quote.id)}
                              disabled={awardingId !== null}
                              className="mt-2 px-4 py-1.5 text-xs font-bold rounded-full bg-success text-white hover:bg-success/90 transition-all disabled:opacity-50"
                            >
                              {awardingId === quote.id ? 'Awarding…' : 'Award'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Pulls the BaseResponse messages[0].message from a failed axios response so
// the user sees the backend's actual reason ("This carrier has already been
// invited…") instead of a generic fallback.
function extractError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { messages?: { message?: string }[] } } }).response?.data;
    const msg = data?.messages?.[0]?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return err instanceof Error ? err.message : fallback;
}

// Renders the lifecycle timestamp tied to the quote's current state.
// Returns empty string if the relevant date isn't populated yet (defensive).
function quoteStateLabel(q: Quote): string {
  switch (q.status) {
    case 'Requested': return q.requestedDate ? `Invited ${relativeDate(q.requestedDate)}` : '';
    case 'Submitted': return q.submittedDate ? `Submitted ${relativeDate(q.submittedDate)}` : '';
    case 'Accepted':
    case 'Declined': return q.reviewedDate ? `Reviewed ${relativeDate(q.reviewedDate)}` : '';
    case 'Expired':  return q.expiredDate  ? `Expired ${relativeDate(q.expiredDate)}`   : '';
    default: return '';
  }
}

// Accepts ISO 8601 (with timezone) from the backend, e.g. "2026-05-13T01:29:00Z".
// Bucketing is by *local* calendar day so "today / yesterday" match the user's
// wall clock even when the UTC date is different (matters near midnight UTC).
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

function QuoteStatusChip({ status }: { status: Quote['status'] }) {
  const styles: Record<Quote['status'], string> = {
    Requested: 'bg-badge-blue-bg text-badge-blue-text',
    Submitted: 'bg-badge-purple-bg text-badge-purple-text',
    Accepted: 'bg-success-bg text-success',
    Declined: 'bg-surface-light text-text-muted',
    Expired: 'bg-warning-bg text-warning',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-normal rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}
