import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AssociationBadge } from '@/components/common/AssociationBadge';
import type { AssociationType } from '@/types';
import {
  BUSINESS_ONBOARDING_STAGES,
  STAGE_TONE,
  onboardingService,
  type BusinessOnboardingRecord,
  type BusinessOnboardingStage,
} from '@/services/tenant_agentOnboardingService';

type ViewMode = 'pipeline' | 'list';
type WorkspaceTab = 'profile' | 'operations' | 'compliance' | 'timeline' | 'activation';

interface CreateFormState {
  businessName: string;
  primaryContact: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  association: AssociationType;
  memberId: string;
  source: BusinessOnboardingRecord['source'];
  notes: string;
  networkPartnerStatus: Extract<BusinessOnboardingRecord['networkPartnerStatus'], 'Candidate' | 'Agent Only'>;
}

const INITIAL_FORM: CreateFormState = {
  businessName: '',
  primaryContact: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  association: 'None',
  memberId: '',
  source: 'Manual Entry',
  notes: '',
  networkPartnerStatus: 'Candidate',
};

function StageBadge({ stage }: { stage: BusinessOnboardingStage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_TONE[stage]}`}>
      {stage}
    </span>
  );
}

function ComplianceBadge({ complete }: { complete: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {complete ? 'Complete' : 'In Progress'}
    </span>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className="mt-3 text-3xl font-bold text-text-primary">{value}</div>
      <div className="mt-2 text-sm text-text-secondary">{detail}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 text-sm text-text-primary">{value}</div>
    </div>
  );
}

function progressPercent(record: BusinessOnboardingRecord) {
  const eligibleStages = BUSINESS_ONBOARDING_STAGES.filter((stage) => stage !== 'Rejected / Archived');
  const idx = eligibleStages.indexOf(record.stage as Exclude<BusinessOnboardingStage, 'Rejected / Archived'>);
  if (record.stage === 'Rejected / Archived') return 100;
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / eligibleStages.length) * 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function ListShell({
  records,
  onAdvanceStage,
  onApproveActivate,
  onArchive,
}: {
  records: BusinessOnboardingRecord[];
  onAdvanceStage: (id: number) => void;
  onApproveActivate: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [associationFilter, setAssociationFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [candidateFilter, setCandidateFilter] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('active');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedRecordId, setExpandedRecordId] = useState<number | null>(null);

  const filteredRecords = useMemo(() => (
    records.filter((record) => {
      const haystack = `${record.businessName} ${record.primaryContact} ${record.city} ${record.state}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      if (stageFilter && record.stage !== stageFilter) return false;
      if (associationFilter && record.association !== associationFilter) return false;
      if (regionFilter && `${record.city}, ${record.state}` !== regionFilter) return false;
      if (candidateFilter === 'yes' && record.networkPartnerStatus !== 'Candidate') return false;
      if (candidateFilter === 'no' && record.networkPartnerStatus === 'Candidate') return false;
      if (complianceFilter === 'complete' && !record.complianceComplete) return false;
      if (complianceFilter === 'incomplete' && record.complianceComplete) return false;
      if (activeFilter === 'active' && record.archived) return false;
      if (activeFilter === 'archived' && !record.archived) return false;
      return true;
    })
  ), [activeFilter, associationFilter, candidateFilter, complianceFilter, records, regionFilter, search, stageFilter]);

  const stageGroups = useMemo(() => (
    BUSINESS_ONBOARDING_STAGES.map((stage) => ({
      stage,
      items: filteredRecords.filter((record) => record.stage === stage),
    }))
  ), [filteredRecords]);

  const liveRecords = records.filter((record) => !record.archived);
  const approvedCount = records.filter((record) => record.stage === 'Approved').length;
  const activatedCount = records.filter((record) => record.stage === 'Activated').length;
  const reviewCount = records.filter((record) => record.stage === 'Review In Progress').length;
  const readyCount = records.filter((record) => record.complianceComplete && (record.stage === 'Review In Progress' || record.stage === 'Approved')).length;
  const candidateCount = records.filter((record) => record.networkPartnerStatus === 'Candidate' && !record.archived).length;

  const applyQuickFilter = (kind: 'open' | 'review' | 'approved' | 'activated' | 'ready' | 'candidates') => {
    setActiveFilter(kind === 'activated' ? 'all' : 'active');
    setStageFilter(kind === 'review' ? 'Review In Progress' : kind === 'approved' ? 'Approved' : kind === 'activated' ? 'Activated' : '');
    setComplianceFilter(kind === 'ready' ? 'complete' : '');
    setCandidateFilter(kind === 'candidates' ? 'yes' : '');
  };

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden">
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Agent / NP Onboarding</div>
            <h1 className="mt-2 text-2xl font-bold text-text-primary">Business onboarding workspace</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/agents/find" className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-brand-cyan hover:text-brand-cyan">
              Find/Add New
            </Link>
            <Link to="/agents/onboarding/new" className="rounded-xl bg-brand-dark px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
              Add Onboarding Record
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
          <button onClick={() => applyQuickFilter('open')} className="rounded-xl border border-border bg-surface-light px-3 py-3 text-left transition-colors hover:border-brand-cyan">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">Open Pipeline</div>
            <div className="mt-1 text-xl font-bold text-text-primary">{liveRecords.length}</div>
          </button>
          <button onClick={() => applyQuickFilter('review')} className="rounded-xl border border-border bg-surface-light px-3 py-3 text-left transition-colors hover:border-brand-cyan">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">In Review</div>
            <div className="mt-1 text-xl font-bold text-text-primary">{reviewCount}</div>
          </button>
          <button onClick={() => applyQuickFilter('approved')} className="rounded-xl border border-border bg-surface-light px-3 py-3 text-left transition-colors hover:border-brand-cyan">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">Approved</div>
            <div className="mt-1 text-xl font-bold text-text-primary">{approvedCount}</div>
          </button>
          <button onClick={() => applyQuickFilter('activated')} className="rounded-xl border border-border bg-surface-light px-3 py-3 text-left transition-colors hover:border-brand-cyan">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">Activated</div>
            <div className="mt-1 text-xl font-bold text-text-primary">{activatedCount}</div>
          </button>
          <button onClick={() => applyQuickFilter('ready')} className="rounded-xl border border-border bg-surface-light px-3 py-3 text-left transition-colors hover:border-brand-cyan">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">Ready</div>
            <div className="mt-1 text-xl font-bold text-text-primary">{readyCount}</div>
          </button>
          <button onClick={() => applyQuickFilter('candidates')} className="rounded-xl border border-border bg-surface-light px-3 py-3 text-left transition-colors hover:border-brand-cyan">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">NP Candidates</div>
            <div className="mt-1 text-xl font-bold text-text-primary">{candidateCount}</div>
          </button>
        </div>
      </div>

      <SectionCard title="Pipeline Management" subtitle="Filter by business stage, source association, geography, NP candidacy, and readiness.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, contact, city, or state" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Onboarding Stage</label>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="">All Stages</option>
              {BUSINESS_ONBOARDING_STAGES.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Association</label>
            <select value={associationFilter} onChange={(e) => setAssociationFilter(e.target.value)}>
              <option value="">All Associations</option>
              <option value="ECA">ECA</option>
              <option value="CLDA">CLDA</option>
              <option value="None">None</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Region</label>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="">All Regions</option>
              {[...new Set(records.map((record) => `${record.city}, ${record.state}`))].map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">NP Candidate</label>
            <select value={candidateFilter} onChange={(e) => setCandidateFilter(e.target.value)}>
              <option value="">All</option>
              <option value="yes">Candidate</option>
              <option value="no">Not Candidate</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Compliance</label>
            <select value={complianceFilter} onChange={(e) => setComplianceFilter(e.target.value)}>
              <option value="">All</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Visibility</label>
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${viewMode === 'pipeline' ? 'bg-brand-dark text-white' : 'border border-border bg-white text-text-secondary'}`}
            >
              Pipeline View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${viewMode === 'list' ? 'bg-brand-dark text-white' : 'border border-border bg-white text-text-secondary'}`}
            >
              List View
            </button>
          </div>
        </div>

        {viewMode === 'pipeline' ? (
          // w-0 + min-w-full prevents the inner `min-w-max` flex container
          // from forcing all ancestors to expand past viewport. The wrapper
          // fills the available width and scrolls horizontally internally.
          <div className="mt-6 w-0 min-w-full overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {stageGroups.map(({ stage, items }) => (
                <div key={stage} className="w-[280px] rounded-2xl border border-border bg-slate-50/70 p-4 xl:w-[300px]">
                  <div className="flex items-center justify-between gap-3">
                    <StageBadge stage={stage} />
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary">{items.length}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-white p-4 text-sm text-text-muted">
                        No businesses in this stage.
                      </div>
                    ) : items.map((record) => (
                      <div key={record.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <button
                              onClick={() => navigate(`/agents/onboarding/${record.id}`)}
                              className="text-left text-base font-bold text-text-primary transition-colors hover:text-brand-cyan"
                            >
                              {record.businessName}
                            </button>
                            <div className="mt-1 text-sm text-text-secondary">{record.primaryContact} · {record.city}, {record.state}</div>
                          </div>
                          <AssociationBadge association={record.association} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{record.networkPartnerStatus}</span>
                          <ComplianceBadge complete={record.complianceComplete} />
                        </div>
                        <div className="mt-4 text-xs text-text-muted">Owner: {record.owner} · Updated {formatDate(record.lastUpdated)}</div>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => navigate(`/agents/onboarding/${record.id}`)}
                            className="flex-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-brand-cyan hover:text-brand-cyan"
                          >
                            Open Workspace
                          </button>
                          {stage !== 'Activated' && stage !== 'Rejected / Archived' && (
                            <button
                              onClick={() => onAdvanceStage(record.id)}
                              className="rounded-xl bg-brand-cyan px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-300"
                            >
                              Advance
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 max-w-full overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[860px] border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Business Name</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Primary Contact</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Location</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Association</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Onboarding Stage</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Business Compliance</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Last Updated</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Advance</th>
                  <th className="w-10 px-3 py-3 text-center font-semibold text-text-muted"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const expanded = expandedRecordId === record.id;

                  return (
                    <Fragment key={record.id}>
                      <tr
                        onClick={() => setExpandedRecordId(expanded ? null : record.id)}
                        className={`cursor-pointer border-t border-border transition-colors hover:bg-slate-50 ${expanded ? 'bg-slate-50/80 shadow-[inset_0_-1px_0_0_rgba(226,232,240,0.9)]' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <div className="font-semibold text-text-primary">{record.businessName}</div>
                          <div className="text-xs text-text-muted">{record.source}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div>{record.primaryContact}</div>
                          <div className="text-xs text-text-muted">{record.email}</div>
                        </td>
                        <td className="px-3 py-3">{record.city}, {record.state}</td>
                        <td className="px-3 py-3"><AssociationBadge association={record.association} /></td>
                        <td className="px-3 py-3"><StageBadge stage={record.stage} /></td>
                        <td className="px-3 py-3"><ComplianceBadge complete={record.complianceComplete} /></td>
                        <td className="px-3 py-3">{formatDate(record.lastUpdated)}</td>
                        <td className="px-3 py-3">
                          {record.stage !== 'Activated' && record.stage !== 'Rejected / Archived' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAdvanceStage(record.id);
                              }}
                              className="rounded-xl bg-brand-cyan px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-cyan-300"
                            >
                              Advance
                            </button>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRecordId(expanded ? null : record.id);
                            }}
                            aria-label={expanded ? 'Collapse row' : 'Expand row'}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:border-brand-cyan hover:text-brand-cyan"
                          >
                            <span className={`text-sm leading-none transition-transform ${expanded ? 'rotate-180' : ''}`}>⌄</span>
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                          <td colSpan={9} className="px-3 py-3">
                            <InlineDetailWorkspace
                              record={record}
                              onAdvanceStage={onAdvanceStage}
                              onApproveActivate={onApproveActivate}
                              onArchive={onArchive}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function CreateRecord({
  onCreate,
}: {
  onCreate: (form: CreateFormState) => Promise<number>;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const newId = await onCreate(form);
      navigate(`/agents/onboarding/${newId}`);
    } catch (e: any) {
      setError(e?.response?.data?.messages?.[0]?.message ?? e?.message ?? 'Failed to create onboarding record.');
      setSaving(false);
    }
  };

  const canSubmit = form.businessName.trim() && form.primaryContact.trim() && form.phone.trim() && form.city.trim() && form.state.trim() && !saving;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/agents/onboarding" className="text-sm text-text-secondary transition-colors hover:text-brand-cyan">← Back to onboarding pipeline</Link>
          <h1 className="mt-3 text-3xl font-bold text-text-primary">Create business onboarding record</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Capture the business essentials, set the prospect source, and route the record into the onboarding workflow starting at Prospect Identified.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Business Profile" subtitle="Business-first fields only. No driver or applicant terminology.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Business Name</label>
              <input value={form.businessName} onChange={(e) => update('businessName', e.target.value)} placeholder="Metro Express Couriers" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Primary Contact</label>
              <input value={form.primaryContact} onChange={(e) => update('primaryContact', e.target.value)} placeholder="Jordan Smith" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Phone</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+1 312-555-0101" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Email</label>
              <input value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="contact@business.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">City</label>
              <input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Chicago" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">State</label>
              <input value={form.state} onChange={(e) => update('state', e.target.value)} placeholder="IL" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Onboarding Intake" subtitle="Set how this business entered the workflow and whether it is being evaluated as an NP.">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Association</label>
              <select value={form.association} onChange={(e) => update('association', e.target.value as AssociationType)}>
                <option value="None">None</option>
                <option value="ECA">ECA</option>
                <option value="CLDA">CLDA</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Member ID</label>
              <input value={form.memberId} onChange={(e) => update('memberId', e.target.value)} placeholder="Optional association member ID" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Lead Source</label>
              <select value={form.source} onChange={(e) => update('source', e.target.value as CreateFormState['source'])}>
                <option value="Manual Entry">Manual Entry</option>
                <option value="Directory Search">Directory Search</option>
                <option value="Imported Lead">Imported Lead</option>
                <option value="Referral">Referral</option>
                <option value="Outbound">Outbound</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Network Partner Status</label>
              <select value={form.networkPartnerStatus} onChange={(e) => update('networkPartnerStatus', e.target.value as CreateFormState['networkPartnerStatus'])}>
                <option value="Candidate">Candidate</option>
                <option value="Agent Only">Agent Only</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Notes / Source Context</label>
              <textarea rows={5} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Why are we onboarding this business now? Any market context or relationship notes?" />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Save Outcome" subtitle="Saving creates a new onboarding record at Prospect Identified and opens the detail workspace.">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-text-secondary">
            On save: create onboarding record, default stage to <span className="font-semibold text-text-primary">Prospect Identified</span>, and route directly into the business onboarding workspace.
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/agents/onboarding')}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-brand-cyan hover:text-brand-cyan"
            >
              Cancel
            </button>
            <button
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="rounded-xl bg-brand-cyan px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {saving ? 'Creating…' : 'Create Onboarding Record'}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function InlineDetailWorkspace({
  record,
  onAdvanceStage,
  onApproveActivate,
  onArchive,
}: {
  record: BusinessOnboardingRecord;
  onAdvanceStage: (id: number) => void;
  onApproveActivate: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const nextStage = BUSINESS_ONBOARDING_STAGES[BUSINESS_ONBOARDING_STAGES.indexOf(record.stage) + 1];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-bold text-text-primary">{record.businessName}</div>
            <StageBadge stage={record.stage} />
            <AssociationBadge association={record.association} />
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{record.networkPartnerStatus}</span>
          </div>
          <div className="mt-1 text-sm text-text-secondary">{record.primaryContact} · {record.phone} · {record.email} · {record.city}, {record.state}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {record.stage !== 'Activated' && record.stage !== 'Rejected / Archived' && nextStage && (
            <button
              onClick={() => onAdvanceStage(record.id)}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-brand-cyan hover:text-brand-cyan"
            >
              Move to {nextStage}
            </button>
          )}
          {record.stage !== 'Activated' && (
            <button
              onClick={() => onApproveActivate(record.id)}
              className="rounded-xl bg-brand-cyan px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-cyan-300"
            >
              Approve & Activate
            </button>
          )}
          <button
            onClick={() => onArchive(record.id)}
            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            Archive
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Lead Source</div>
            <div className="mt-1 text-sm text-text-primary">{record.source}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Business Compliance</div>
            <div className="mt-1"><ComplianceBadge complete={record.complianceComplete} /></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Last Updated</div>
            <div className="mt-1 text-sm text-text-primary">{formatDate(record.lastUpdated)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Coverage</div>
            <div className="mt-1 text-sm text-text-primary">{record.coverage.join(', ')}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Operational Capacity</div>
            <div className="mt-1 text-sm text-text-primary">{record.estimatedDrivers} delivery resources</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Owner / Reviewer</div>
            <div className="mt-1 text-sm text-text-primary">{record.owner} · {record.reviewer}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Service Capabilities</div>
            <div className="mt-1 text-sm text-text-primary">{record.serviceCapabilities.join(', ')}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Notes</div>
            <div className="mt-1 text-sm text-text-secondary">{record.notes}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceGateBanner({ record }: { record: BusinessOnboardingRecord }) {
  const missingOrPending = record.complianceItems.filter(
    (item) => item.status !== 'complete',
  );
  const allComplete = missingOrPending.length === 0 && record.complianceItems.length > 0;

  if (allComplete) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="text-lg leading-none">✅</span>
          <div>
            <div className="text-sm font-semibold text-green-800">
              Compliance complete — drivers can be added
            </div>
            <div className="mt-1 text-xs text-green-600">
              All {record.complianceItems.length} mandatory compliance documents have been approved.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none">⚠️</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-amber-800">
            This partner cannot add drivers until all mandatory compliance documents are approved
          </div>
          <div className="mt-2 space-y-1">
            {missingOrPending.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                    item.status === 'missing'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {item.status === 'missing' ? 'Missing' : 'In Progress'}
                </span>
                <span className="text-amber-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailWorkspace({
  record,
  onAdvanceStage,
  onApproveActivate,
  onArchive,
}: {
  record: BusinessOnboardingRecord;
  onAdvanceStage: (id: number) => void;
  onApproveActivate: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('profile');
  const progress = progressPercent(record);
  const timeline = record.timeline ?? [];
  const nextStage = BUSINESS_ONBOARDING_STAGES[BUSINESS_ONBOARDING_STAGES.indexOf(record.stage) + 1];
  const complianceComplete = record.complianceItems.length > 0 && record.complianceItems.every((item) => item.status === 'complete');

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'profile', label: 'Business Profile' },
    { id: 'operations', label: 'Operational Fit' },
    { id: 'compliance', label: 'Business Compliance' },
    { id: 'timeline', label: 'Onboarding Timeline' },
    { id: 'activation', label: 'Activation Outcome' },
  ];

  return (
    <div className="space-y-6">
      {/* Compliance Gate Banner */}
      <ComplianceGateBanner record={record} />

      <div className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/agents/onboarding" className="text-sm text-text-secondary transition-colors hover:text-brand-cyan">← Back to onboarding pipeline</Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-text-primary">{record.businessName}</h1>
              <StageBadge stage={record.stage} />
              <AssociationBadge association={record.association} />
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{record.networkPartnerStatus}</span>
            </div>
            <div className="mt-2 text-sm text-text-secondary">
              {record.primaryContact} · {record.phone} · {record.email} · {record.city}, {record.state}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={!complianceComplete}
              title={complianceComplete ? 'Add a driver to this partner' : 'Complete all compliance documents before adding drivers'}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                complianceComplete
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'cursor-not-allowed bg-slate-200 text-slate-500'
              }`}
            >
              {complianceComplete ? '+ Add Driver' : '🔒 Add Driver'}
            </button>
            {record.stage !== 'Activated' && record.stage !== 'Rejected / Archived' && nextStage && (
              <button
                onClick={() => onAdvanceStage(record.id)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-brand-cyan hover:text-brand-cyan"
              >
                Move to {nextStage}
              </button>
            )}
            {record.stage !== 'Activated' && (
              <button
                onClick={() => onApproveActivate(record.id)}
                className="rounded-xl bg-brand-cyan px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-300"
              >
                Approve & Activate
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl bg-surface-light p-4">
            <div className="text-xs uppercase tracking-wide text-text-muted">Onboarding Progress</div>
            <div className="mt-2 text-2xl font-bold text-text-primary">{progress}%</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-cyan" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="rounded-2xl bg-surface-light p-4">
            <div className="text-xs uppercase tracking-wide text-text-muted">Coverage</div>
            <div className="mt-2 text-2xl font-bold text-text-primary">{record.coverage.length}</div>
            <div className="mt-1 text-sm text-text-secondary">Cities or territories in scope</div>
          </div>
          <div className="rounded-2xl bg-surface-light p-4">
            <div className="text-xs uppercase tracking-wide text-text-muted">Operational Capacity</div>
            <div className="mt-2 text-2xl font-bold text-text-primary">{record.estimatedDrivers}</div>
            <div className="mt-1 text-sm text-text-secondary">Estimated delivery capacity available through this business</div>
          </div>
          <div className="rounded-2xl bg-surface-light p-4">
            <div className="text-xs uppercase tracking-wide text-text-muted">Compliance Readiness</div>
            <div className="mt-2 text-2xl font-bold text-text-primary">{record.complianceItems.filter((item) => item.status === 'complete').length}/{record.complianceItems.length}</div>
            <div className="mt-1 text-sm text-text-secondary">Business compliance items complete</div>
          </div>
        </div>

        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.id ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard title="Business Profile" subtitle="The core business record that this onboarding is managing.">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InfoField label="Business Name" value={record.businessName} />
              <InfoField label="Primary Contact" value={record.primaryContact} />
              <InfoField label="Email" value={record.email} />
              <InfoField label="Phone" value={record.phone} />
              <InfoField label="Address" value={`${record.address}, ${record.city}, ${record.state}`} />
              <InfoField label="Association / Member ID" value={record.association === 'None' ? 'Independent' : `${record.association}${record.memberId ? ` · ${record.memberId}` : ''}`} />
              <InfoField label="Lead Source" value={record.source} />
              <InfoField label="Owner / Reviewer" value={`${record.owner} · ${record.reviewer}`} />
            </div>
            <div className="mt-6 rounded-2xl bg-surface-light p-4 text-sm text-text-secondary">{record.notes}</div>
          </SectionCard>

          <SectionCard title="Readiness Summary" subtitle="A quick business-level view before review and activation.">
            <div className="space-y-4">
              <div className="rounded-2xl bg-surface-light p-4">
                <div className="text-xs uppercase tracking-wide text-text-muted">Onboarding Stage</div>
                <div className="mt-2"><StageBadge stage={record.stage} /></div>
              </div>
              <div className="rounded-2xl bg-surface-light p-4">
                <div className="text-xs uppercase tracking-wide text-text-muted">Business Compliance</div>
                <div className="mt-2"><ComplianceBadge complete={record.complianceComplete} /></div>
              </div>
              <div className="rounded-2xl bg-surface-light p-4">
                <div className="text-xs uppercase tracking-wide text-text-muted">Network Partner Status</div>
                <div className="mt-2 text-sm font-semibold text-text-primary">{record.networkPartnerStatus}</div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'operations' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="Operational Fit" subtitle="Business capabilities, service footprint, and fleet profile.">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InfoField label="Cities / Territory" value={record.coverage.join(', ')} />
              <InfoField label="Fleet Profile" value={record.fleetProfile} />
              <InfoField label="Operational Capacity" value={`${record.estimatedDrivers} delivery resources`} />
              <InfoField label="Service Capabilities" value={record.serviceCapabilities.join(', ')} />
            </div>
            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Specialties</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {record.specialties.map((specialty) => (
                  <span key={specialty} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Qualification Signals" subtitle="What makes this business a fit for onboarding.">
            <div className="space-y-3 text-sm text-text-secondary">
              <div className="rounded-2xl bg-surface-light p-4">Coverage footprint aligns to <span className="font-semibold text-text-primary">{record.coverage[0]}</span> and surrounding territory expansion.</div>
              <div className="rounded-2xl bg-surface-light p-4">Operational mix supports <span className="font-semibold text-text-primary">{record.serviceCapabilities.join(', ')}</span>.</div>
              <div className="rounded-2xl bg-surface-light p-4">Current source is <span className="font-semibold text-text-primary">{record.source}</span>, which is preserved in the onboarding record for follow-up.</div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'compliance' && (
        <SectionCard title="Business Compliance" subtitle="Track business documents and review readiness without using driver-level terminology.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {record.complianceItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-text-primary">{item.label}</div>
                    <div className="mt-1 text-sm text-text-secondary">Last updated {formatDate(item.updatedAt)}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    item.status === 'complete'
                      ? 'bg-green-100 text-green-700'
                      : item.status === 'in_progress'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {item.status === 'complete' ? 'Complete' : item.status === 'in_progress' ? 'In Progress' : 'Missing'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === 'timeline' && (
        <SectionCard title="Onboarding Timeline" subtitle="Activity notes, stage progression, and ownership.">
          <div className="space-y-4">
            {timeline.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-text-primary">{item.title}</div>
                    <div className="mt-1 text-sm text-text-secondary">{item.detail}</div>
                  </div>
                  <div className="text-right text-xs text-text-muted">
                    <div>{item.owner}</div>
                    <div className="mt-1">{formatDate(item.timestamp)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === 'activation' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Activation Outcome" subtitle="Approve, activate to directory, or archive the business onboarding record.">
            <div className="space-y-4 text-sm text-text-secondary">
              <div className="rounded-2xl bg-surface-light p-4">
                Approve & Activate simulates the phase-2 conversion behavior: collected onboarding data stays with the record while the business becomes active in the Agent/NP directory.
              </div>
              <div className="rounded-2xl bg-surface-light p-4">
                Current stage is <span className="font-semibold text-text-primary">{record.stage}</span>. Compliance is <span className="font-semibold text-text-primary">{record.complianceComplete ? 'complete' : 'still in progress'}</span>.
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => onApproveActivate(record.id)}
                  className="rounded-xl bg-brand-cyan px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-300"
                >
                  Approve & Activate
                </button>
                <button
                  onClick={() => onArchive(record.id)}
                  className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  Archive Record
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Directory Handoff" subtitle="Phase 1 shell for the business conversion path.">
            <div className="space-y-4 text-sm text-text-secondary">
              <div className="rounded-2xl bg-surface-light p-4">
                When activated, this business should appear in Directory as an active Agent / NP record and remain linked back to this onboarding history.
              </div>
              <div className="rounded-2xl bg-surface-light p-4">
                Existing agent detail pages remain separate from this onboarding workspace, preserving workflow clarity between recruiting businesses and managing live partners.
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-text-muted shadow-sm">Loading onboarding workspace…</div>;
}

export function AgentOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isCreateRoute = location.pathname.endsWith('/new');
  const numericId = id ? Number(id) : null;

  // null = loading; [] or populated once loaded.
  const [records, setRecords] = useState<BusinessOnboardingRecord[] | null>(null);
  // undefined = loading; null = not found; record = loaded.
  const [detailRecord, setDetailRecord] = useState<BusinessOnboardingRecord | null | undefined>(undefined);

  const loadList = useCallback(async () => {
    try { setRecords(await onboardingService.list()); }
    catch { setRecords([]); }
  }, []);

  // List route: load the pipeline.
  useEffect(() => {
    if (numericId === null && !isCreateRoute) loadList();
  }, [numericId, isCreateRoute, loadList]);

  // Detail route: load the single record.
  useEffect(() => {
    if (numericId === null) { setDetailRecord(undefined); return; }
    let cancelled = false;
    setDetailRecord(undefined);
    onboardingService.get(numericId)
      .then((r) => { if (!cancelled) setDetailRecord(r); })
      .catch(() => { if (!cancelled) setDetailRecord(null); });
    return () => { cancelled = true; };
  }, [numericId]);

  const refreshDetail = async (recordId: number) => {
    try { setDetailRecord(await onboardingService.get(recordId)); }
    catch { /* keep current view; transition errors surface via the action */ }
  };

  const handleAdvanceStage = async (recordId: number) => {
    await onboardingService.advanceStage(recordId);
    if (numericId !== null) await refreshDetail(recordId); else await loadList();
  };

  const handleApproveActivate = async (recordId: number) => {
    await onboardingService.approveActivate(recordId);
    if (numericId !== null) await refreshDetail(recordId); else await loadList();
  };

  const handleArchive = async (recordId: number) => {
    await onboardingService.archive(recordId);
    navigate('/agents/onboarding');
  };

  const handleCreate = (form: CreateFormState) => onboardingService.create({
    businessName: form.businessName,
    primaryContact: form.primaryContact,
    phone: form.phone,
    email: form.email,
    city: form.city,
    state: form.state,
    association: form.association,
    memberId: form.memberId,
    source: form.source,
    notes: form.notes,
    networkPartnerStatus: form.networkPartnerStatus,
  }).then((r) => r.id);

  // Detail route.
  if (numericId !== null) {
    if (detailRecord === undefined) return <LoadingState />;
    if (detailRecord === null) return <Navigate to="/agents/onboarding" replace />;
    return (
      <DetailWorkspace
        record={detailRecord}
        onAdvanceStage={handleAdvanceStage}
        onApproveActivate={handleApproveActivate}
        onArchive={handleArchive}
      />
    );
  }

  if (isCreateRoute) {
    return <CreateRecord onCreate={handleCreate} />;
  }

  if (records === null) return <LoadingState />;

  return (
    <ListShell
      records={records}
      onAdvanceStage={handleAdvanceStage}
      onApproveActivate={handleApproveActivate}
      onArchive={handleArchive}
    />
  );
}
