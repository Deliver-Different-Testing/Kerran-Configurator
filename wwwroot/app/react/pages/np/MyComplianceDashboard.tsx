// MyComplianceDashboard — cut-down NP-facing version of the redesigned
// Compliance Monitoring page. NP self-service, lands at `/compliance`.
//
// Spec: docs/STEVE-NP-COMPLIANCE-DASHBOARD-2026-06-13.md
//
// Mirrors the tenant-side page (ComplianceMonitoringPage) but scoped to the
// caller's own data and stripped of staff-only affordances:
//
//   - "My documents needing attention" lists the NP's own business documents
//     that are expired, expiring soon, missing, or rejected. The action is
//     Upload (sends the operator to /compliance/my-documents) — no Verify/
//     Reject because that's a staff surface.
//   - "My couriers at risk" lists the NP's own couriers whose compliance
//     flag is not 'ok', ordered worst-first. Open courier jumps to the
//     courier detail page.
//
// The existing /compliance/my-documents page (upload form + full required-
// docs table) stays as the "manage everything" deep-link.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { myAgentDocsApi, type AgentComplianceDetail, type AgentDocRequirementStatus, type AgentDocument } from '@/services/np_agentComplianceService';
import { useCouriers } from '@/hooks/useCouriers';
import type { Courier } from '@/types';
import { MyAgentDocumentPreviewModal } from '@/components/np/MyAgentDocumentPreviewModal';

type DocStatus = AgentDocRequirementStatus['status'];

// Action a requirement needs. Used both to sort the "needs attention" list and
// to render a row's badge.
type RowState =
  | { kind: 'expired'; days: number }
  | { kind: 'expiring-urgent'; days: number }
  | { kind: 'expiring'; days: number }
  | { kind: 'rejected' }
  | { kind: 'missing' }
  | { kind: 'pending' };

function stateFor(r: AgentDocRequirementStatus): RowState {
  if (r.isExpired)         return { kind: 'expired', days: r.daysUntilExpiry ?? 0 };
  if (r.isExpiringUrgent)  return { kind: 'expiring-urgent', days: r.daysUntilExpiry ?? 0 };
  if (r.isExpiring)        return { kind: 'expiring', days: r.daysUntilExpiry ?? 0 };
  if (r.status === 'rejected')      return { kind: 'rejected' };
  if (r.status === 'missing')       return { kind: 'missing' };
  return { kind: 'pending' };
}

// Lower sortOrder = more urgent.
function sortOrder(s: RowState): number {
  switch (s.kind) {
    case 'expired':         return 0;
    case 'rejected':        return 1;
    case 'expiring-urgent': return 2;
    case 'expiring':        return 3;
    case 'missing':         return 4;
    default:                return 5;
  }
}

function stateLabel(s: RowState): string {
  switch (s.kind) {
    case 'expired':         return `Expired ${Math.abs(s.days)}d ago`;
    case 'expiring-urgent': return `Expires in ${s.days}d`;
    case 'expiring':        return `Expires in ${s.days}d`;
    case 'rejected':        return 'Rejected';
    case 'missing':         return 'Missing';
    case 'pending':         return 'Under review';
  }
}

function stateTone(s: RowState): string {
  switch (s.kind) {
    case 'expired':
    case 'rejected':        return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    case 'expiring-urgent': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    case 'expiring':        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    case 'missing':         return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200';
    case 'pending':         return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
  }
}

function courierTone(status: Courier['compliance']): string {
  switch (status) {
    case 'expired': return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    case 'warning': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    default:        return 'bg-green-50 text-green-700 ring-1 ring-green-200';
  }
}
function courierLabel(status: Courier['compliance']): string {
  switch (status) {
    case 'expired': return 'Expired';
    case 'warning': return 'At risk';
    default:        return 'OK';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function MyComplianceDashboard() {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AgentComplianceDetail | null>(null);
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<AgentDocument | null>(null);
  const { couriers } = useCouriers();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Fetched in parallel — the second call gives us the actual uploaded
        // document instances so the "View" button on each row can open the
        // NP preview modal.
        const [d, list] = await Promise.all([
          myAgentDocsApi.getCompliance(),
          myAgentDocsApi.list().catch(() => [] as AgentDocument[]),
        ]);
        if (alive) {
          setDetail(d);
          setDocs(list);
        }
      } catch { /* swallowed — empty state renders below */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const requirements = detail?.requirements ?? [];
  const summary = detail?.summary;
  const docById = useMemo(() => {
    const m = new Map<number, AgentDocument>();
    for (const d of docs) m.set(d.id, d);
    return m;
  }, [docs]);

  // Rows for the "my docs needing attention" card — only non-approved.
  const docRows = useMemo(() => {
    const rows = requirements
      .filter((r) => r.status !== 'approved' || r.isExpiring || r.isExpired)
      .map((r) => ({ req: r, state: stateFor(r) }));
    rows.sort((a, b) => sortOrder(a.state) - sortOrder(b.state));
    return rows;
  }, [requirements]);

  // Couriers needing attention — anything not 'ok', worst-first.
  const courierRows = useMemo(() => {
    const order: Record<Courier['compliance'], number> = { expired: 0, warning: 1, ok: 2 };
    return [...couriers]
      .filter((c) => c.compliance !== 'ok')
      .sort((a, b) => order[a.compliance] - order[b.compliance]);
  }, [couriers]);

  // KPI counts.
  const kpi = {
    docsApproved: summary?.approvedMandatoryDocuments ?? 0,
    docsMandatory: summary?.mandatoryDocuments ?? 0,
    docsExpiring: requirements.filter((r) => r.isExpiring || r.isExpired).length,
    courierTotal: couriers.length,
    courierOk: couriers.filter((c) => c.compliance === 'ok').length,
    courierAtRisk: couriers.filter((c) => c.compliance !== 'ok').length,
  };

  return (
    <div className="space-y-5">

      <header>
        <h1 className="text-xl font-bold text-text-primary">Compliance overview</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your documents and your couriers' compliance at a glance. Use this page to spot what needs your action; jump to <Link to="/compliance/my-documents" className="font-semibold text-brand-cyan hover:underline">My Documents</Link> when you're ready to upload.
        </p>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi tone="amber" label="My docs approved" value={`${kpi.docsApproved}/${kpi.docsMandatory}`} meta="Mandatory business documents" />
        <Kpi tone="red"   label="Expiring / expired" value={kpi.docsExpiring} meta="Within 30 days or already past" />
        <Kpi tone="green" label="Couriers OK"       value={`${kpi.courierOk}/${kpi.courierTotal}`} meta="Compliant couriers" />
        <Kpi tone="red"   label="Couriers at risk"  value={kpi.courierAtRisk} meta="Warning or expired status" />
      </div>

      {/* ─── MY DOCUMENTS NEEDING ATTENTION ─── */}
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border-light px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              My documents needing attention
              <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${docRows.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{docRows.length}</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">Expired and rejected first, then expiring, then missing.</p>
          </div>
          <Link
            to="/compliance/my-documents"
            className="rounded-lg bg-brand-cyan/10 px-3 py-1.5 text-sm font-semibold text-brand-cyan hover:bg-brand-cyan/20"
          >
            Manage all documents →
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-text-muted">Loading your documents…</div>
        ) : docRows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-base font-semibold text-text-primary">All caught up</p>
            <p className="mt-1 text-sm text-text-muted">No expired, expiring, missing or rejected documents right now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light bg-slate-50">
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Document</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Expiry</th>
                  <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted"></th>
                </tr>
              </thead>
              <tbody>
                {docRows.map(({ req, state }) => {
                  const uploaded = req.documentId ? docById.get(req.documentId) ?? null : null;
                  return (
                    <tr key={req.documentTypeId} className="border-b border-border-light last:border-b-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="text-sm font-semibold text-text-primary">{req.documentTypeName}</div>
                        <div className="text-[11px] text-text-muted">{req.mandatory ? 'Required' : 'Optional'}{req.source === 'onboarding' ? ' · from onboarding' : ''}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${stateTone(state)}`}>
                          {stateLabel(state)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-text-secondary">{req.expiryDate ?? '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {uploaded && (
                            <button
                              onClick={() => setPreviewDoc(uploaded)}
                              className="rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50 px-3 py-1.5 text-sm font-semibold"
                            >
                              View
                            </button>
                          )}
                          <Link
                            to="/compliance/my-documents"
                            className="rounded-lg bg-brand-cyan/10 px-3 py-1.5 text-sm font-semibold text-brand-cyan hover:bg-brand-cyan/20"
                          >
                            Upload →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── MY COURIERS AT RISK ─── */}
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border-light px-5 py-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            My couriers at risk
            <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${courierRows.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{courierRows.length}</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">Expired licences first, then anyone with a warning status. Open courier to see the documents.</p>
        </div>

        {courierRows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-base font-semibold text-text-primary">No couriers at risk</p>
            <p className="mt-1 text-sm text-text-muted">Every courier on your fleet is currently compliant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light bg-slate-50">
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Courier</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Vehicle</th>
                  <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted"></th>
                </tr>
              </thead>
              <tbody>
                {courierRows.map((c) => (
                  <tr key={c.id} className="border-b border-border-light last:border-b-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-[10px] font-bold text-white">
                          {initials(`${c.firstName} ${c.surName}`)}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{c.firstName} {c.surName}</div>
                          <div className="text-[11px] text-text-muted">Code {c.code} · {c.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${courierTone(c.compliance)}`}>
                        {courierLabel(c.compliance)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-text-secondary">
                      {[c.make, c.model, c.rego].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => navigate(`/courier/${c.id}`)}
                        className="text-sm font-semibold text-brand-cyan hover:underline"
                      >
                        Open courier →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MyAgentDocumentPreviewModal
        isOpen={previewDoc !== null}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}

function Kpi({ tone, label, value, meta }: { tone: 'amber' | 'red' | 'green'; label: string; value: number | string; meta: string }) {
  const dot = tone === 'amber' ? 'bg-amber-500' : tone === 'red' ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dot}`} />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{label}</div>
        <div className="mt-1 font-display text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1 text-[11px] text-text-muted">{meta}</div>
      </div>
    </div>
  );
}

// silence the unused-types warning since we re-export the status type below;
// keeps the IDE happy without leaking internals.
export type { DocStatus };
