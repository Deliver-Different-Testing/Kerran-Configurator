// Compliance Monitoring — redesigned action-first surface.
//
// Spec: docs/STEVE-COMPLIANCE-MONITORING-REDESIGN-2026-06-13.md
//
// Replaces the previous NP/Agents vs Drivers/Contractors split inside the
// ComplianceHub's Monitoring section with a unified page focused on the work:
//
//   1. KPI strip (clickable filters) — Pending review / Non-complying /
//      At risk / Compliant.
//   2. "Documents waiting on your review" action queue — flat list of every
//      pending business document across all in-scope agents, default-sorted
//      AI Accept first then by upload age. Clicking a row opens the preview
//      modal (commit 14f04c1) so staff can Verify/Reject in one click.
//   3. "Subjects needing attention" risk list — NPs + drivers (drivers will
//      light up once GARRY-NP-COURIER-DATA-WIRING-2026-06-13.md §1 ships)
//      ranked by risk worst-to-best. "Open docs" jumps straight to the
//      Agent/NP Compliance tab via the `?tab=agent-np-compliance` query
//      param honoured by AgentWorkspace.
//
// Backend: GET /api/v1/np/compliance/pending-documents (new) for the queue;
// the risk list reuses the existing useAgentComplianceRoster + useAgents.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgents } from '@/hooks/useAgents';
import { useAgentComplianceRoster, usePendingDocuments } from '@/hooks/useAgentCompliance';
import type { PendingDocumentItem } from '@/services/np_agentComplianceService';
import { AgentDocumentPreviewModal } from '@/components/tenant/AgentDocumentPreviewModal';

type KpiFilter = 'pending' | 'non-complying' | 'at-risk' | 'compliant' | null;
type QueueFilter = 'all' | 'nps-only' | 'drivers-only' | 'ai-needs-review';
type RiskTab = 'all' | 'nps' | 'drivers';

function relativeTime(iso: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMin = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function aiToneClass(d?: string | null): string {
  switch (d) {
    case 'accept':       return 'bg-green-50 text-green-700 ring-1 ring-green-200';
    case 'reject':       return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    case 'needs_review': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    default:             return 'bg-slate-50 text-slate-500 ring-1 ring-slate-200';
  }
}
function aiLabel(d?: string | null): string {
  switch (d) {
    case 'accept':       return 'AI: Accept';
    case 'reject':       return 'AI: Reject';
    case 'needs_review': return 'AI: Needs review';
    default:             return 'No AI review';
  }
}

function riskPillClass(level: 'High' | 'Medium' | 'Low' | string): string {
  switch (level) {
    case 'High':   return 'bg-red-50 text-red-700';
    case 'Medium': return 'bg-amber-50 text-amber-700';
    default:       return 'bg-sky-50 text-sky-700';
  }
}
function riskLabel(level: 'High' | 'Medium' | 'Low' | string): string {
  switch (level) {
    case 'High':   return 'Critical';
    case 'Medium': return 'Urgent';
    default:       return 'Watch';
  }
}

export function ComplianceMonitoringPage() {
  const navigate = useNavigate();
  const { items: queue, loading: queueLoading, refresh: refreshQueue } = usePendingDocuments();
  const { roster, byId: rosterById, loading: rosterLoading } = useAgentComplianceRoster();
  const { agents } = useAgents();

  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [riskTab, setRiskTab] = useState<RiskTab>('all');
  const [previewDoc, setPreviewDoc] = useState<PendingDocumentItem | null>(null);

  // ─── KPI metrics ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const pending = queue.length;
    let nonComplying = 0, atRisk = 0, compliant = 0;
    for (const r of roster) {
      if (r.riskLevel === 'High') nonComplying++;
      else if (r.riskLevel === 'Medium') atRisk++;
      else compliant++;
    }
    return { pending, nonComplying, atRisk, compliant };
  }, [queue, roster]);

  // ─── Queue filters ────────────────────────────────────────────────────
  const filteredQueue = useMemo(() => {
    return queue.filter(d => {
      if (queueFilter === 'nps-only' && d.subjectType !== 'Agent') return false;
      if (queueFilter === 'drivers-only' && d.subjectType !== 'Driver') return false;
      if (queueFilter === 'ai-needs-review' && d.aiSuggestedDecision !== 'needs_review') return false;
      return true;
    });
  }, [queue, queueFilter]);

  // ─── Risk list ────────────────────────────────────────────────────────
  // Combine NP/agents (live) + drivers (future-wire stub) into one list.
  // Driver-side compliance is mock today — see GARRY-NP-COURIER-DATA-WIRING
  // §1; the courier roster slot is reserved but left empty so this section
  // automatically lights up the day Garry's punch list lands.
  const riskRows = useMemo(() => {
    const npRows = roster.map((r) => {
      const agent = agents.find(a => a.id === r.agentId);
      const missing = r.summary.missingDocuments + r.summary.rejectedDocuments;
      const totalMandatory = Math.max(1, r.summary.mandatoryDocuments);
      return {
        kind: 'NP' as const,
        id: r.agentId,
        name: agent?.name ?? `Agent #${r.agentId}`,
        scope: [agent?.city, agent?.state].filter(Boolean).join(' · ') || 'Agent / NP',
        riskLevel: r.riskLevel,
        missing,
        totalMandatory,
        approvedMandatory: r.summary.approvedMandatoryDocuments,
        score: r.overallScorePercent,
      };
    });
    // Sort: High > Medium > Low, then most-missing first.
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return [...npRows].sort((a, b) => {
      const r = (order[a.riskLevel] ?? 9) - (order[b.riskLevel] ?? 9);
      if (r !== 0) return r;
      return b.missing - a.missing;
    });
  }, [roster, agents]);

  const filteredRisk = riskRows.filter(r =>
    riskTab === 'all' ||
    (riskTab === 'nps' && r.kind === 'NP')
    // 'drivers' tab will show driver rows once the courier-roster hook ships.
  );

  const kpiCount = { pending: totals.pending, nonComplying: totals.nonComplying, atRisk: totals.atRisk, compliant: totals.compliant };
  const totalSubjects = roster.length;

  const handleOpenDocs = (agentId: number) => navigate(`/agents/${agentId}?tab=agent-np-compliance`);

  return (
    <div className="space-y-5">

      {/* ─── KPI strip ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Pending review"  value={kpiCount.pending}      dotClass="bg-amber-500" meta="Uploaded docs awaiting verify"        active={kpiFilter === 'pending'}       onClick={() => setKpiFilter(f => f === 'pending' ? null : 'pending')} />
        <Kpi label="Non-complying"   value={kpiCount.nonComplying} dotClass="bg-red-500"   meta="Subjects missing mandatory docs"     active={kpiFilter === 'non-complying'} onClick={() => setKpiFilter(f => f === 'non-complying' ? null : 'non-complying')} />
        <Kpi label="At risk"         value={kpiCount.atRisk}       dotClass="bg-amber-500" meta="Medium-risk subjects"                active={kpiFilter === 'at-risk'}       onClick={() => setKpiFilter(f => f === 'at-risk' ? null : 'at-risk')} />
        <Kpi label="Compliant"       value={kpiCount.compliant}    dotClass="bg-green-500" meta="Low-risk / fully approved subjects"  active={kpiFilter === 'compliant'}     onClick={() => setKpiFilter(f => f === 'compliant' ? null : 'compliant')} />
      </div>

      {/* ─── ACTION QUEUE ─── */}
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border-light px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              Documents waiting on your review
              <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${kpiCount.pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{kpiCount.pending}</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">AI accept‑class first (easy wins), then oldest upload. Click a row to preview.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QueueChip active={queueFilter === 'all'}              onClick={() => setQueueFilter('all')}>All</QueueChip>
            <QueueChip active={queueFilter === 'nps-only'}         onClick={() => setQueueFilter('nps-only')}>NPs only</QueueChip>
            <QueueChip active={queueFilter === 'drivers-only'}     onClick={() => setQueueFilter('drivers-only')}>Drivers only</QueueChip>
            <QueueChip active={queueFilter === 'ai-needs-review'}  onClick={() => setQueueFilter('ai-needs-review')}>AI says: needs review</QueueChip>
          </div>
        </div>

        {queueLoading ? (
          <div className="px-5 py-10 text-center text-sm text-text-muted">Loading queue…</div>
        ) : filteredQueue.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-base font-semibold text-text-primary">All caught up</p>
            <p className="mt-1 text-sm text-text-muted">No pending documents match the current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border-light bg-slate-50">
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Document</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Subject</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">AI suggestion</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Uploaded</th>
                  <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted"></th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map((d) => (
                  <tr key={d.id} className="border-b border-border-light last:border-b-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="text-sm font-semibold text-text-primary">{d.documentTypeName}</div>
                      <div className="text-[11px] font-mono text-text-muted truncate max-w-[260px]">{d.fileName}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-[10px] font-bold text-white">
                          {initials(d.subjectName)}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{d.subjectName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${d.subjectType === 'Agent' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>{d.subjectType === 'Agent' ? 'NP' : 'Driver'}</span>
                            <span className="text-[11px] text-text-muted">{[d.subjectCity, d.subjectState].filter(Boolean).join(' · ') || ''}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${aiToneClass(d.aiSuggestedDecision)}`}>{aiLabel(d.aiSuggestedDecision)}</span>
                      {d.aiSuggestedExpiry && (
                        <div className="mt-1 text-[11px] text-text-muted">Suggested expiry {d.aiSuggestedExpiry}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-text-muted">{relativeTime(d.uploadedDate)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setPreviewDoc(d)}
                        className="rounded-lg bg-brand-cyan/10 px-3 py-1.5 text-sm font-semibold text-brand-cyan hover:bg-brand-cyan/20"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── RISK LIST ─── */}
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border-light px-5 py-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            Subjects needing attention
            <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${totalSubjects > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>{totalSubjects}</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">Worst-to-best. "Open docs" jumps straight to the subject's compliance tab — no overview detour.</p>
        </div>

        <div className="flex flex-wrap gap-2 px-5 pt-4">
          <RiskTabBtn active={riskTab === 'all'}     onClick={() => setRiskTab('all')}>All ({totalSubjects})</RiskTabBtn>
          <RiskTabBtn active={riskTab === 'nps'}     onClick={() => setRiskTab('nps')}>NPs / Agents ({totalSubjects})</RiskTabBtn>
          <RiskTabBtn active={riskTab === 'drivers'} onClick={() => setRiskTab('drivers')}>Drivers / Contractors (—)</RiskTabBtn>
        </div>

        {rosterLoading ? (
          <div className="px-5 py-10 text-center text-sm text-text-muted">Loading risk list…</div>
        ) : filteredRisk.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-muted">No subjects are currently at risk.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border-light bg-slate-50">
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Subject</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Risk</th>
                  <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Missing mandatory docs</th>
                  <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRisk.map((r) => {
                  const missingPct = Math.round((r.missing / r.totalMandatory) * 100);
                  const barColor = r.riskLevel === 'High' ? 'bg-red-500' : r.riskLevel === 'Medium' ? 'bg-amber-500' : 'bg-sky-500';
                  return (
                    <tr key={`${r.kind}-${r.id}`} className="border-b border-border-light last:border-b-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-[10px] font-bold text-white">
                            {initials(r.name)}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-text-primary">{r.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${r.kind === 'NP' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>{r.kind === 'NP' ? 'NP' : 'Driver'}</span>
                              <span className="text-[11px] text-text-muted">{r.scope}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskPillClass(r.riskLevel)}`}>{riskLabel(r.riskLevel)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 max-w-xs">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${missingPct}%` }} />
                          </div>
                          <span className="text-xs text-text-muted whitespace-nowrap">{r.missing} / {r.totalMandatory} missing</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleOpenDocs(r.id)}
                          className="text-sm font-semibold text-brand-cyan hover:underline"
                        >
                          Open docs →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Preview modal — wired to the same AgentDocumentPreviewModal used on the
          agent workspace. Refresh the queue + roster on changed so the row
          drops out of the queue without a full reload. */}
      <AgentDocumentPreviewModal
        isOpen={previewDoc !== null}
        agentId={previewDoc?.agentId ?? 0}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onChanged={() => { refreshQueue(); }}
      />
    </div>
  );
}

// ───────────────────────────── primitives ─────────────────────────────

function Kpi({ label, value, dotClass, meta, active, onClick }: { label: string; value: number; dotClass: string; meta: string; active: boolean; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-all hover:border-brand-cyan/60 ${active ? 'border-brand-cyan shadow-[0_0_0_3px_rgba(59,199,244,0.18)]' : 'border-border'}`}
    >
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotClass}`} />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{label}</div>
        <div className="mt-1 font-display text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1 text-[11px] text-text-muted">{meta}</div>
      </div>
    </button>
  );
}

function QueueChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode; }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-text-primary bg-text-primary text-white' : 'border-border bg-white text-text-muted hover:bg-slate-50 hover:text-text-primary'}`}
    >
      {children}
    </button>
  );
}

function RiskTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode; }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-brand-cyan/60 bg-brand-cyan/10 text-brand-cyan' : 'border-border bg-slate-50 text-text-muted hover:text-text-primary'}`}
    >
      {children}
    </button>
  );
}
