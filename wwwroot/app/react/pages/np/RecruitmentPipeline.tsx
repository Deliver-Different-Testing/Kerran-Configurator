import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecruitment } from '@/hooks/useRecruitment';
import { complianceProfileService } from '@/services/np_complianceProfileService';
import { fleetService } from '@/services/np_fleetService';
import type { CourierApplicant, ApplicantPipelineStage, ApplicantDocumentSummary } from '@/types';

const STAGES: ApplicantPipelineStage[] = [
  'Registration', 'Email Verification', 'Profile', 'Documentation',
  'Declaration/Contract', 'Training', 'Approval',
];

const STAGE_COLORS: Record<string, string> = {
  'Registration': 'bg-blue-100 text-blue-700',
  'Email Verification': 'bg-indigo-100 text-indigo-700',
  'Profile': 'bg-purple-100 text-purple-700',
  'Documentation': 'bg-amber-100 text-amber-700',
  'Declaration/Contract': 'bg-orange-100 text-orange-700',
  'Training': 'bg-teal-100 text-teal-700',
  'Approval': 'bg-green-100 text-green-700',
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function StageBadge({ stage }: { stage: ApplicantPipelineStage }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600'}`}>
      {stage}
    </span>
  );
}

function ComplianceIndicator({ documents }: { documents?: ApplicantDocumentSummary[] }) {
  if (!documents || documents.length === 0) return <span className="text-xs text-gray-400">No docs</span>;
  const mandatory = documents.filter(d => d.mandatory);
  if (mandatory.length === 0) return <span className="text-xs text-gray-400">—</span>;
  const verified = mandatory.filter(d => d.status === 'verified').length;
  const uploaded = mandatory.filter(d => d.status === 'uploaded').length;
  const missing = mandatory.filter(d => d.status === 'missing').length;
  const total = mandatory.length;
  const allGood = verified === total;

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden flex">
        {verified > 0 && <div className="h-full bg-green-500" style={{ width: `${(verified / total) * 100}%` }} />}
        {uploaded > 0 && <div className="h-full bg-amber-400" style={{ width: `${(uploaded / total) * 100}%` }} />}
      </div>
      <span className={`text-xs font-bold ${allGood ? 'text-green-600' : missing > 0 ? 'text-red-500' : 'text-amber-600'}`}>
        {verified}/{total}
      </span>
      {missing > 0 && <span className="text-[10px] text-red-500">🚫 {missing} missing</span>}
      {allGood && <span className="text-[10px] text-green-600">✅</span>}
    </div>
  );
}

function isApplicantReady(a: CourierApplicant): boolean {
  const docs = a.documents || [];
  const mandatory = docs.filter(d => d.mandatory);
  return mandatory.length > 0 && mandatory.every(d => d.status === 'verified');
}

type SortField = 'name' | 'stage' | 'days' | 'compliance';
type SortDir = 'asc' | 'desc';

export default function RecruitmentPipeline() {
  const navigate = useNavigate();
  // Read-only pipeline (Slice A) — only the applicant list is consumed;
  // approve/resubmit actions land in a later slice.
  const { applicants } = useRecruitment();
  const [searchInput, setSearchInput] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [complianceFilter, setComplianceFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'all' | 'ready' | 'rejected'>('all');
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'stage', dir: 'asc' });

  // Activate modal state
  const [activateModal, setActivateModal] = useState<CourierApplicant | null>(null);
  const [activateFleetId, setActivateFleetId] = useState<number | null>(null);
  const [activateDepotId, setActivateDepotId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const depots = fleetService.getDepots();
  const fleets = fleetService.getAll();
  // Openforce check — reads from localStorage like Settings page
  const openforceEnabled = useMemo(() => {
    // In real app this comes from tenant config; for demo just check localStorage
    try { return JSON.parse(localStorage.getItem('np_openforce_enabled') || 'false'); } catch { return false; }
  }, []);

  useEffect(() => {
    const config = complianceProfileService.getRecruitmentConfig();
    if (config.recruitmentViewMode === 'ready_for_review') setViewMode('ready');
  }, []);

  const activeApplicants = useMemo(() =>
    applicants.filter(a => !a.rejectedDate && !a.approvedAsCourierId),
  [applicants]);

  const rejectedApplicants = useMemo(() =>
    applicants.filter(a => a.rejectedDate != null && !a.approvedAsCourierId),
  [applicants]);

  // Mock "rejected by" data for display
  const rejectedByMap: Record<number, string> = {
    9: 'Sarah Mitchell (Compliance)',
    10: 'James Torres (Operations)',
    11: 'Rachel Kim (Training)',
  };

  const approved = applicants.filter(a => a.approvedAsCourierId).length;
  const totalActive = activeApplicants.length;
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES.forEach(s => counts[s] = 0);
    activeApplicants.forEach(a => { if (counts[a.pipelineStage] !== undefined) counts[a.pipelineStage]++; });
    return counts;
  }, [activeApplicants]);
  const readyCount = activeApplicants.filter(a => isApplicantReady(a) && a.pipelineStage === 'Approval').length;

  // Filtering
  const filtered = useMemo(() => {
    let list = viewMode === 'ready'
      ? activeApplicants.filter(a => isApplicantReady(a) && a.pipelineStage === 'Approval')
      : activeApplicants;

    if (searchInput) {
      const q = searchInput.toLowerCase();
      list = list.filter(a =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
      );
    }
    if (stageFilter) list = list.filter(a => a.pipelineStage === stageFilter);
    if (locationFilter) list = list.filter(a => a.city?.toLowerCase().includes(locationFilter.toLowerCase()));
    if (complianceFilter === 'ready') list = list.filter(a => isApplicantReady(a));
    if (complianceFilter === 'missing') list = list.filter(a => {
      const docs = a.documents || [];
      return docs.some(d => d.mandatory && d.status === 'missing');
    });
    if (complianceFilter === 'pending') list = list.filter(a => {
      const docs = a.documents || [];
      return docs.some(d => d.status === 'uploaded') && !docs.some(d => d.mandatory && d.status === 'missing');
    });

    return list;
  }, [activeApplicants, viewMode, searchInput, stageFilter, locationFilter, complianceFilter]);

  // Sorting
  const sorted = useMemo(() => {
    const stageOrder = Object.fromEntries(STAGES.map((s, i) => [s, i]));
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case 'name': cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`); break;
        case 'stage': cmp = (stageOrder[a.pipelineStage] ?? 99) - (stageOrder[b.pipelineStage] ?? 99); break;
        case 'days': cmp = daysSince(b.modifiedDate || b.createdDate) - daysSince(a.modifiedDate || a.createdDate); break;
        case 'compliance': {
          const score = (x: CourierApplicant) => { const m = (x.documents || []).filter(d => d.mandatory); return m.length ? m.filter(d => d.status === 'verified').length / m.length : 0; };
          cmp = score(b) - score(a);
          break;
        }
        default: cmp = 0;
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const toggleSort = (field: SortField) => {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  };
  const sortIcon = (field: SortField) => sort.field === field ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';

  const handleActivate = () => {
    if (!activateModal) return;
    // Approve → courier promotion is a later recruitment slice; the read-only
    // pipeline shows the applicant's completed requirements but can't activate.
    setToast('Activating an applicant as a courier is coming in the next update.');
    setTimeout(() => setToast(null), 3500);
    setActivateModal(null);
    setActivateFleetId(null);
    setActivateDepotId(null);
  };

  const handleSendToOpenforce = () => {
    if (!activateModal) return;
    // In real app: POST to Openforce API
    setToast(`${activateModal.firstName} ${activateModal.lastName} sent to Openforce`);
    setTimeout(() => setToast(null), 3000);
    setActivateModal(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Recruitment Pipeline</h1>
          <p className="text-sm text-text-secondary mt-1">Track applicants from registration through to courier activation</p>
        </div>
      </div>

      {/* Stage pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setStageFilter(''); setViewMode('all'); }}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
            !stageFilter && viewMode === 'all' ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white text-text-secondary border-border hover:border-brand-cyan'
          }`}
        >
          All ({totalActive})
        </button>
        {STAGES.map(stage => (
          <button
            key={stage}
            onClick={() => { setStageFilter(stage); setViewMode('all'); }}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
              stageFilter === stage ? 'bg-brand-dark text-white border-brand-dark' : `bg-white text-text-secondary border-border hover:border-brand-cyan ${stageCounts[stage] === 0 ? 'opacity-40' : ''}`
            }`}
          >
            {stage} ({stageCounts[stage]})
          </button>
        ))}
        <button
          onClick={() => { setStageFilter(''); setViewMode('ready'); }}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
            viewMode === 'ready' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-600 border-green-300 hover:border-green-500'
          }`}
        >
          ✓ Ready to Activate ({readyCount})
        </button>
        <button
          onClick={() => { setStageFilter(''); setViewMode('rejected'); }}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
            viewMode === 'rejected' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-300 hover:border-red-500'
          }`}
        >
          ✗ Rejected ({rejectedApplicants.length})
          {rejectedApplicants.length > 0 && viewMode !== 'rejected' && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
              {rejectedApplicants.length}
            </span>
          )}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="flex-1 min-w-[200px] max-w-sm px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
        />
        <select
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white"
        >
          <option value="">All Depots</option>
          {depots.map(d => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
        <select
          value={complianceFilter}
          onChange={e => setComplianceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white"
        >
          <option value="">All Compliance</option>
          <option value="ready">✅ All Docs Verified</option>
          <option value="pending">🔄 Docs Pending Review</option>
          <option value="missing">🚫 Docs Missing</option>
        </select>
        <span className="ml-auto text-xs text-text-secondary">
          {viewMode === 'rejected'
            ? `${rejectedApplicants.length} rejected · ${rejectedApplicants.length} resubmittable`
            : `Showing ${sorted.length} of ${totalActive} active · ${approved} activated · ${rejectedApplicants.length} rejected · ${totalActive + approved + rejectedApplicants.length} total`
          }
        </span>
      </div>

      {/* Rejected Applicants Alert Banner */}
      {viewMode !== 'rejected' && rejectedApplicants.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">
              {rejectedApplicants.length}
            </span>
            <span className="text-sm font-medium text-red-800">
              rejected applicant{rejectedApplicants.length !== 1 ? 's' : ''} can be resubmitted
            </span>
          </div>
          <button
            onClick={() => { setStageFilter(''); setViewMode('rejected'); }}
            className="text-xs font-semibold text-red-700 hover:text-red-900 underline"
          >
            Review rejected →
          </button>
        </div>
      )}

      {/* Rejected Applicants Table */}
      {viewMode === 'rejected' && (
        <div className="bg-white border border-border rounded-lg overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-red-50">
                <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">Applicant</th>
                <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">Last Stage</th>
                <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">Rejection Reason</th>
                <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">Rejected Date</th>
                <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">Rejected By</th>
                <th className="text-right text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rejectedApplicants.map(a => (
                <tr key={a.id} className="hover:bg-surface-cream transition-colors">
                  <td className="px-4 py-3 border-b border-border">
                    <div className="font-medium text-sm text-text-primary">{a.firstName} {a.lastName}</div>
                    <div className="text-xs text-text-secondary">{a.email}</div>
                    {a.city && <div className="text-xs text-text-muted">{a.city}, {a.state}</div>}
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <StageBadge stage={a.pipelineStage} />
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <div className="text-sm text-red-700 max-w-xs">{a.rejectedReason || '—'}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-sm text-text-secondary">
                    {a.rejectedDate ? new Date(a.rejectedDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 border-b border-border text-sm text-text-secondary">
                    {rejectedByMap[a.id] || 'System'}
                  </td>
                  <td className="px-4 py-3 border-b border-border text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          // Resubmit is a later recruitment slice (stage actions).
                          setToast('Re-submitting an applicant is coming in the next update.');
                          setTimeout(() => setToast(null), 3500);
                        }}
                        className="text-xs px-3 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 font-medium transition-colors whitespace-nowrap"
                      >
                        ↩ Resubmit
                      </button>
                      <button
                        onClick={() => navigate(`/recruitment/${a.id}`)}
                        className="text-xs text-brand-cyan hover:underline font-medium"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rejectedApplicants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-secondary">
                    No rejected applicants
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Table */}
      {viewMode !== 'rejected' && <div className="bg-white border border-border rounded-lg overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-light">
              <th onClick={() => toggleSort('name')} className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border cursor-pointer hover:text-brand-cyan select-none">
                Applicant{sortIcon('name')}
              </th>
              <th onClick={() => toggleSort('stage')} className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border cursor-pointer hover:text-brand-cyan select-none">
                Stage{sortIcon('stage')}
              </th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">
                Location
              </th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">
                Vehicle
              </th>
              <th onClick={() => toggleSort('compliance')} className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border cursor-pointer hover:text-brand-cyan select-none">
                Compliance{sortIcon('compliance')}
              </th>
              <th onClick={() => toggleSort('days')} className="text-center text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border cursor-pointer hover:text-brand-cyan select-none">
                Days{sortIcon('days')}
              </th>
              <th className="text-right text-xs font-semibold text-text-primary uppercase tracking-wide px-4 py-3 border-b border-border">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(a => {
              const days = daysSince(a.modifiedDate || a.createdDate);
              const ready = isApplicantReady(a);
              const atApproval = a.pipelineStage === 'Approval';
              const canActivate = ready && atApproval;

              return (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/recruitment/${a.id}`)}
                  className={`hover:bg-surface-cream cursor-pointer transition-colors ${canActivate ? 'bg-green-50/30' : ''}`}
                >
                  <td className="px-4 py-3 border-b border-border">
                    <div className="font-medium text-sm text-text-primary">{a.firstName} {a.lastName}</div>
                    <div className="text-xs text-text-secondary">{a.email}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <StageBadge stage={a.pipelineStage} />
                  </td>
                  <td className="px-4 py-3 border-b border-border text-sm text-text-secondary">
                    {a.city ? `${a.city}, ${a.state}` : '—'}
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    {a.vehicleType ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan">{a.vehicleType}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <ComplianceIndicator documents={a.documents} />
                  </td>
                  <td className="px-4 py-3 border-b border-border text-center">
                    <span className={`text-sm font-medium ${days > 14 ? 'text-red-500' : days > 7 ? 'text-amber-600' : 'text-text-secondary'}`}>
                      {days}d
                    </span>
                    {days > 14 && <div className="text-[10px] text-red-400">stale</div>}
                  </td>
                  <td className="px-4 py-3 border-b border-border text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      {canActivate && (
                        <button
                          onClick={() => {
                            setActivateModal(a);
                            setActivateFleetId(null);
                            setActivateDepotId(null);
                          }}
                          className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 font-medium transition-colors whitespace-nowrap"
                        >
                          Activate as Courier
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/recruitment/${a.id}`)}
                        className="text-xs text-brand-cyan hover:underline font-medium"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                  {viewMode === 'ready'
                    ? 'No applicants are ready for activation yet'
                    : 'No applicants match the current filters'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>}

      {/* Activate as Courier Modal */}
      {activateModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setActivateModal(null); }}>
          <div className="bg-white rounded-xl shadow-xl border border-border w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-border">
              <h3 className="text-lg font-bold">Activate as Courier</h3>
              <p className="text-sm text-text-secondary mt-1">
                <strong>{activateModal.firstName} {activateModal.lastName}</strong> has completed all recruitment requirements
              </p>
            </div>
            <div className="p-5 space-y-4">
              {/* Verified docs summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">✅ Compliance Complete</div>
                <div className="space-y-1">
                  {(activateModal.documents || []).filter(d => d.mandatory).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-green-700">
                      <span>✓</span>
                      <span>{d.documentTypeName}</span>
                      {d.expiryDate && <span className="text-green-500 ml-auto">exp {new Date(d.expiryDate).toLocaleDateString()}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Assign to fleet */}
              <div>
                <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1.5">Assign to Fleet</label>
                <select
                  value={activateFleetId ?? ''}
                  onChange={e => setActivateFleetId(Number(e.target.value) || null)}
                  className="w-full border border-border rounded-md p-2.5 text-sm"
                >
                  <option value="">Select fleet...</option>
                  {fleets.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Assign to depot */}
              <div>
                <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1.5">Assign to Depot</label>
                <select
                  value={activateDepotId ?? ''}
                  onChange={e => setActivateDepotId(Number(e.target.value) || null)}
                  className="w-full border border-border rounded-md p-2.5 text-sm"
                >
                  <option value="">Select depot...</option>
                  {depots.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-border space-y-3">
              {/* Primary action */}
              <button
                onClick={handleActivate}
                disabled={!activateFleetId || !activateDepotId}
                className="w-full bg-green-600 text-white py-2.5 rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ✓ Activate as Courier
              </button>

              {/* Openforce alternative */}
              {openforceEnabled && (
                <button
                  onClick={handleSendToOpenforce}
                  className="w-full bg-white border-2 border-indigo-300 text-indigo-700 py-2.5 rounded-md text-sm font-semibold hover:bg-indigo-50 transition-colors"
                >
                  Send to Openforce Instead
                </button>
              )}

              <button
                onClick={() => setActivateModal(null)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-brand-dark text-white px-4 py-3 rounded-lg shadow-lg text-sm z-[300]">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
