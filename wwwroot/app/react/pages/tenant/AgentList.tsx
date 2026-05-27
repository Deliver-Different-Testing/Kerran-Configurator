import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AssociationBadge } from '@/components/common/AssociationBadge';
import Modal from '@/components/common/Modal';
import { AgentWorkspace, NpComplianceBar } from '@/components/tenant/AgentWorkspace';
import { TierBadge } from '@/components/tenant/TierBadge';
import { getAgentStatusTone } from './agentComplianceService';
import { useAgents as useLiveAgents } from '@/hooks/useAgents';
import { NpManagement } from './NpManagement';
import { agentService, tenantLookupService, LookupItem } from '@/services/tenant_agentService';
import { prospectService, ProspectAgent } from '@/services/tenant_prospectService';
import type { Agent, CitySuggestion } from '@/types';

function AgentStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAgentStatusTone(status as any)}`}>
      {status}
    </span>
  );
}

type ListMode = 'directory' | 'find';
type AgentTab = 'all' | 'network-partners';

export function AgentList() {
  const location = useLocation();
  const navigate = useNavigate();
  // Phase 5+1 Pass 2: AgentList now reads live agents from /api/v1/tenant/agents
  // (was mock-backed via agentComplianceService.useAgents). Fields not yet
  // populated by the backend (city/state/contactName/association/coverageAreas/
  // clientsServiced/approvedPrograms/npDocs) get safe defaults in
  // tenant_agentService.toAgent so consumers don't crash. Pass 3 wires those
  // joins (Suburb / TucAgentStatus / TucClientContact) once those entities are
  // scaffolded into Core/Domain/Despatch.
  const { agents, loading: liveLoading, error: liveError, refetch } = useLiveAgents();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [draft, setDraft] = useState<Partial<Agent> | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [statuses, setStatuses] = useState<LookupItem[]>([]);
  const [rankings, setRankings] = useState<LookupItem[]>([]);
  const [clientTypes, setClientTypes] = useState<LookupItem[]>([]);   // Phase 5+27.1
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Text buffer for the coverage-area chip editor in the Edit Agent modal.
  const [coverageInput, setCoverageInput] = useState('');
  // Phase 5+29b §C — debounced city autocomplete state.
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced fetch of city suggestions while the operator types. Backend
  // requires q.length >= 2 (short-circuits to [] otherwise) — we mirror
  // that here to avoid sending one-char hits.
  useEffect(() => {
    const q = coverageInput.trim();
    if (q.length < 2) {
      setCitySuggestions([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      tenantLookupService.getCities(q)
        .then(rows => { if (alive) setCitySuggestions(rows); })
        .catch(() => { if (alive) setCitySuggestions([]); });
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [coverageInput]);

  useEffect(() => {
    let alive = true;
    tenantLookupService.getAgentStatuses().then(s => { if (alive) setStatuses(s); });
    tenantLookupService.getAgentRankings().then(r => { if (alive) setRankings(r); });
    tenantLookupService.getClientTypes().then(t => { if (alive) setClientTypes(t); });
    return () => { alive = false; };
  }, []);

  // Prospect directory (the 821-row pre-seeded carrier list from migration 023).
  // Backend filters by `association` and `search`; fetch is debounced 250ms so
  // typing in the search box doesn't hammer the endpoint.
  const [prospects, setProspects] = useState<ProspectAgent[]>([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  async function handleAddPartner(prospect: ProspectAgent) {
    setConvertingId(prospect.id);
    setConvertError(null);
    try {
      const { agentId } = await prospectService.convert(prospect.id);
      // Mark the local row as converted so the badge flips and the button
      // disables, without re-fetching the whole list.
      setProspects(prev => prev.map(p => p.id === prospect.id ? { ...p, convertedToAgent: true } : p));
      // Refresh the agents list in the background so the new agent shows in
      // the directory tab; navigate user to the directory so they see it.
      await refetch();
      navigate(`/agents`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to convert prospect';
      setConvertError(msg);
    } finally {
      setConvertingId(null);
    }
  }

  const NEW_AGENT_DEFAULTS: Partial<Agent> = {
    name: '',
    phone: '',
    address: '',
    postCode: '',
    notes: '',
    statusId: undefined,
    rankingId: null,
    isNetworkPartner: false,
    npPortalEnabled: false,
    npTierByte: 1,
    contactName: '',
    email: '',
    association: 'None',
    associationMemberId: '',
    defaultCourierPayPercent: null,
    // Phase 5+27.1 — defaults to 3 (NetworkPartner). Field only takes effect
    // server-side when IsNetworkPartner=true (no TucClient is created
    // otherwise). Operator can override via the picker.
    clientTypeId: 3,
  };

  function openEdit(agent: Agent) {
    setEditing(agent);
    setDraft({ ...agent });
    setCreateMode(false);
    setSaveError(null);
  }

  function openCreate() {
    setEditing(null);
    setDraft({ ...NEW_AGENT_DEFAULTS });
    setCreateMode(true);
    setSaveError(null);
  }

  function closeModal() {
    setEditing(null);
    setDraft(null);
    setCreateMode(false);
    setSaveError(null);
    setCoverageInput('');
  }

  // Adds a coverage area to the draft (trimmed, case-insensitively de-duped)
  // and clears the input + suggestion dropdown. Accepts either:
  //   - a CitySuggestion clicked from the dropdown (canonical seed match)
  //   - a free-text fallback (matches backend's soft-fail path — parent
  //     still saves with zero children, chip will render the yellow
  //     "no zips mapped" badge after the next read).
  function addCoverageArea(override?: string) {
    if (!draft) return;
    const area = (override ?? coverageInput).trim();
    if (!area) return;
    const current = draft.coverageAreas ?? [];
    if (!current.some((a) => a.toLowerCase() === area.toLowerCase())) {
      setDraft({ ...draft, coverageAreas: [...current, area] });
    }
    setCoverageInput('');
    setShowSuggestions(false);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (createMode) {
        await agentService.create(draft);
      } else if (editing) {
        await agentService.update(editing.id, draft);
      }
      await refetch();
      closeModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save agent';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }
  const [activeTab, setActiveTab] = useState<AgentTab>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assocFilter, setAssocFilter] = useState('');
  const [npFilter, setNpFilter] = useState('');
  const [addForm, setAddForm] = useState({ firstName: '', surname: '', email: '', mobile: '', company: '', vehicleType: '', notes: '' });
  const [directorySearch, setDirectorySearch] = useState('');
  const [selectedDirectory, setSelectedDirectory] = useState<'CLDA' | 'ECA'>('CLDA');
  const [expandedAgentId, setExpandedAgentId] = useState<number | null>(null);

  const mode: ListMode = location.pathname === '/agents' ? 'directory' : 'find';

  // Debounced live-fetch of the prospect directory whenever the user changes
  // the search text or the CLDA/ECA tab. Only runs when the page is in 'find'
  // mode so it doesn't waste cycles on the directory list.
  useEffect(() => {
    if (mode !== 'find') return;
    let alive = true;
    setProspectsLoading(true);
    const handle = setTimeout(() => {
      prospectService.search({ search: directorySearch.trim() || undefined, association: selectedDirectory })
        .then(p => { if (alive) setProspects(p); })
        .finally(() => { if (alive) setProspectsLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(handle); };
  }, [mode, directorySearch, selectedDirectory]);

  const filtered = useMemo(() => agents.filter((agent) => {
    const haystack = `${agent.name} ${agent.city} ${agent.contactName}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (statusFilter && agent.status !== statusFilter) return false;
    if (assocFilter && agent.association !== assocFilter) return false;
    if (npFilter === 'yes' && !agent.isNetworkPartner) return false;
    if (npFilter === 'no' && agent.isNetworkPartner) return false;
    if (npFilter === 'pending' && agent.status !== 'Pending NP') return false;
    if (npFilter === 'potential' && agent.status !== 'Potential') return false;
    return true;
  }), [agents, assocFilter, npFilter, search, statusFilter]);

  const npCount = agents.filter((agent) => agent.isNetworkPartner).length;
  const pendingNpCount = agents.filter((agent) => agent.status === 'Pending NP').length;
  const potentialCount = agents.filter((agent) => agent.status === 'Potential').length;
  const activeCount = agents.filter((agent) => agent.status === 'Active').length;

  // `prospects` is loaded via the debounced effect above — already filtered
  // server-side by selectedDirectory + directorySearch.

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Agent/NPs</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            {activeCount} active · {npCount} NPs · {pendingNpCount} pending · {potentialCount} potential · {agents.length} total
          </p>
          <p className="mt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {liveLoading
                ? 'Loading live data…'
                : liveError
                ? `Live data error: ${liveError}`
                : `Live from DB: ${npCount} NPs / ${agents.length} agents`}
            </span>
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow"
        >
          + Add Agent
        </button>
      </div>

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 border-b border-border">
        {([['all', 'All Agents'], ['network-partners', 'Network Partners']] as [AgentTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? 'border-brand-cyan text-brand-cyan'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'network-partners' ? (
        <NpManagement />
      ) : mode === 'find' ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-blue-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="mb-1 text-sm font-bold text-blue-600">Add New Partner</h3>
                <p className="text-xs text-text-secondary">Create a partner record for someone you found outside the directory.</p>
              </div>
              <Link to="/agents/onboarding" className="text-sm font-medium text-brand-cyan hover:underline">
                Need full onboarding? Open partner onboarding →
              </Link>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <input placeholder="First Name *" value={addForm.firstName} onChange={(event) => setAddForm((current) => ({ ...current, firstName: event.target.value }))} className="rounded-md border border-border px-3 py-2 text-sm" />
              <input placeholder="Surname *" value={addForm.surname} onChange={(event) => setAddForm((current) => ({ ...current, surname: event.target.value }))} className="rounded-md border border-border px-3 py-2 text-sm" />
              <input placeholder="Email" value={addForm.email} onChange={(event) => setAddForm((current) => ({ ...current, email: event.target.value }))} className="rounded-md border border-border px-3 py-2 text-sm" />
              <input placeholder="Mobile *" value={addForm.mobile} onChange={(event) => setAddForm((current) => ({ ...current, mobile: event.target.value }))} className="rounded-md border border-border px-3 py-2 text-sm" />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <input placeholder="Company / Trading Name" value={addForm.company} onChange={(event) => setAddForm((current) => ({ ...current, company: event.target.value }))} className="rounded-md border border-border px-3 py-2 text-sm" />
              <select value={addForm.vehicleType} onChange={(event) => setAddForm((current) => ({ ...current, vehicleType: event.target.value }))} className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary">
                <option value="">Vehicle Type</option>
                <option>Car</option>
                <option>Van</option>
                <option>Truck</option>
                <option>Motorcycle</option>
              </select>
              <input placeholder="Notes (how you found them)" value={addForm.notes} onChange={(event) => setAddForm((current) => ({ ...current, notes: event.target.value }))} className="col-span-2 rounded-md border border-border px-3 py-2 text-sm" />
            </div>

            <div className="flex items-center gap-3">
              <button
                disabled={!addForm.firstName.trim() || !addForm.surname.trim() || !addForm.mobile.trim()}
                onClick={() => setAddForm({ firstName: '', surname: '', email: '', mobile: '', company: '', vehicleType: '', notes: '' })}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save as Potential Partner
              </button>
              <span className="text-xs text-text-secondary">Quick add keeps this lead in your partner directory without forcing full onboarding.</span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white p-5">
            <h3 className="mb-1 text-sm font-bold text-text-primary">Association Directory Search</h3>
            <p className="mb-4 text-xs text-text-secondary">Search known CLDA and ECA members, then add them directly into your partner directory.</p>

            <div className="mb-4 flex gap-2">
              {(['CLDA', 'ECA'] as const).map((directory) => (
                <button
                  key={directory}
                  onClick={() => setSelectedDirectory(directory)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    selectedDirectory === directory ? 'border-[#3bc7f4] bg-[#3bc7f4]/10 text-[#3bc7f4]' : 'border-border bg-white text-text-secondary hover:border-gray-300'
                  }`}
                >
                  {directory === 'CLDA' ? 'CLDA Directory' : 'ECA Directory'}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder={`Search ${selectedDirectory} members by name or city...`}
              value={directorySearch}
              onChange={(event) => setDirectorySearch(event.target.value)}
              className="mb-4 w-full rounded-full border-2 border-border bg-white px-4 py-2.5 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-[#3bc7f4] focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/20"
            />

            {convertError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                ⚠️ {convertError}
              </div>
            )}

            <div className="space-y-2">
              {prospectsLoading ? (
                <p className="py-6 text-center text-sm text-text-muted">Loading {selectedDirectory} directory…</p>
              ) : prospects.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">No results found</p>
              ) : prospects.map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-[#3bc7f4]/40">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">{record.companyName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${record.association === 'CLDA' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{record.association}</span>
                      {record.isVerified && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">✓ Verified</span>
                      )}
                      {record.convertedToAgent && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">Already an Agent</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-text-secondary">
                      {record.contactName && `${record.contactName} · `}
                      {record.city}{record.state ? `, ${record.state}` : ''}
                      {record.phone && ` · ${record.phone}`}
                      {record.fleetSize != null && ` · Fleet ${record.fleetSize}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {record.specialties.map((specialty) => (
                        <span key={specialty} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{specialty}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    disabled={record.convertedToAgent || convertingId === record.id}
                    onClick={() => handleAddPartner(record)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-[#3bc7f4] transition-colors hover:bg-[#3bc7f4]/5 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {record.convertedToAgent
                      ? 'In Directory'
                      : convertingId === record.id
                      ? 'Adding…'
                      : 'Add Partner'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary">Search</label>
                <input
                  type="text"
                  placeholder="Search partners and network partners..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-full border-2 border-border bg-white px-4 py-2.5 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary">Status</label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-full border-2 border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-brand-cyan focus:outline-none">
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Pending NP">Pending NP</option>
                  <option value="Potential">Potential</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary">Association</label>
                <select value={assocFilter} onChange={(event) => setAssocFilter(event.target.value)} className="rounded-full border-2 border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-brand-cyan focus:outline-none">
                  <option value="">All Associations</option>
                  <option value="ECA">ECA</option>
                  <option value="CLDA">CLDA</option>
                  <option value="None">None</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary">Type</label>
                <select value={npFilter} onChange={(event) => setNpFilter(event.target.value)} className="rounded-full border-2 border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-brand-cyan focus:outline-none">
                  <option value="">All Types</option>
                  <option value="yes">Network Partners</option>
                  <option value="pending">Pending NP</option>
                  <option value="potential">Potential</option>
                  <option value="no">Agents Only</option>
                </select>
              </div>
            </div>
          </div>

          <div className="max-w-full overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
            <table className="w-full min-w-[860px] border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Business Name</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Location</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Phone</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Status</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Association</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Type</th>
                  <th className="w-10 px-3 py-3 text-center font-semibold text-text-muted"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-muted">No partners match your filters</td>
                  </tr>
                ) : filtered.map((agent) => {
                  const expanded = expandedAgentId === agent.id;

                  return (
                    <Fragment key={agent.id}>
                      <tr
                        onClick={() => setExpandedAgentId(expanded ? null : agent.id)}
                        className={`cursor-pointer border-t border-border transition-colors hover:bg-slate-50 ${expanded ? 'bg-slate-50/80 shadow-[inset_0_-1px_0_0_rgba(226,232,240,0.9)]' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <div className="font-semibold text-text-primary">{agent.name}</div>
                          <div className="text-xs text-text-muted">{agent.contactName}</div>
                        </td>
                        <td className="px-3 py-3">{agent.city}, {agent.state}</td>
                        <td className="px-3 py-3">{agent.phone}</td>
                        <td className="px-3 py-3"><AgentStatusBadge status={agent.status} /></td>
                        <td className="px-3 py-3"><AssociationBadge association={agent.association} /></td>
                        <td className="px-3 py-3">
                          {agent.isNetworkPartner ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-badge-purple-bg px-2.5 py-0.5 text-xs font-normal text-badge-purple-text">NP</span>
                              {agent.npTier && <TierBadge tier={agent.npTier} />}
                            </div>
                          ) : agent.status === 'Pending NP' ? (
                            <NpComplianceBar documents={agent.npDocs ?? []} />
                          ) : (
                            <span className="text-xs text-text-muted">Agent</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); openEdit(agent); }}
                              className="inline-flex h-8 px-2.5 items-center justify-center rounded-lg border border-border bg-white text-xs text-text-secondary transition-colors hover:border-brand-cyan hover:text-brand-cyan"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedAgentId(expanded ? null : agent.id);
                              }}
                              aria-label={expanded ? 'Collapse row' : 'Expand row'}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:border-brand-cyan hover:text-brand-cyan"
                            >
                              <span className={`text-sm leading-none transition-transform ${expanded ? 'rotate-180' : ''}`}>⌄</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                          <td colSpan={7} className="px-3 py-3">
                            <AgentWorkspace agent={{ ...agent, npDocs: agent.npDocs ?? [] }} variant="inline" />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit / Create Agent modal */}
      <Modal open={!!draft} onClose={closeModal}>
        <h2 className="text-xl font-bold mb-2">{createMode ? 'Add Agent' : 'Edit Agent'}</h2>
        <p className="text-text-secondary text-sm mb-4">
          {createMode
            ? 'Create a new partner record. Required fields marked *.'
            : 'Update agent details. Changes apply immediately.'}
        </p>
        {draft && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Name *</label>
              <input
                type="text"
                value={draft.name ?? ''}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Phone</label>
              <input
                type="text"
                value={draft.phone ?? ''}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Post Code</label>
              <input
                type="text"
                value={draft.postCode ?? ''}
                onChange={(e) => setDraft({ ...draft, postCode: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Address</label>
              <input
                type="text"
                value={draft.address ?? ''}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Status</label>
              <select
                value={draft.statusId ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const id = raw === '' ? undefined : Number(raw);
                  setDraft({ ...draft, statusId: id });
                }}
              >
                <option value="">— Select —</option>
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Ranking</label>
              <select
                value={draft.rankingId ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const id = raw === '' ? null : Number(raw);
                  setDraft({ ...draft, rankingId: id });
                }}
              >
                <option value="">— None —</option>
                {rankings.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Contact Name</label>
              <input
                type="text"
                value={draft.contactName ?? ''}
                onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Contact Email</label>
              <input
                type="email"
                value={draft.email ?? ''}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Association</label>
              <select
                value={draft.association ?? 'None'}
                onChange={(e) => setDraft({ ...draft, association: e.target.value as Agent['association'] })}
              >
                <option value="None">None</option>
                <option value="ECA">ECA</option>
                <option value="CLDA">CLDA</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Association Member ID</label>
              <input
                type="text"
                value={draft.associationMemberId ?? ''}
                onChange={(e) => setDraft({ ...draft, associationMemberId: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Default Courier Pay %</label>
              <input
                type="number"
                step="0.01"
                value={draft.defaultCourierPayPercent ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDraft({ ...draft, defaultCourierPayPercent: raw === '' ? null : Number(raw) });
                }}
              />
            </div>
            <div className="flex items-center gap-2 col-span-2 pt-2">
              <input
                type="checkbox"
                id="agent-isnp"
                checked={!!draft.isNetworkPartner}
                onChange={(e) => setDraft({ ...draft, isNetworkPartner: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-brand-cyan focus:ring-brand-cyan focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="agent-isnp" className="text-sm cursor-pointer">Network Partner</label>
            </div>
            {draft.isNetworkPartner && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="agent-portal"
                    checked={!!draft.npPortalEnabled}
                    onChange={(e) => setDraft({ ...draft, npPortalEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand-cyan focus:ring-brand-cyan focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="agent-portal" className="text-sm cursor-pointer">Portal Enabled</label>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">NP Tier</label>
                  <select
                    value={draft.npTierByte ?? 1}
                    onChange={(e) => setDraft({ ...draft, npTierByte: Number(e.target.value) })}
                  >
                    <option value={1}>Base</option>
                    <option value={2}>Multi-Client</option>
                  </select>
                </div>
                {/* Phase 5+27.1 — ClientType picker for the linked TucClient.
                    Defaults to NetworkPartner; operator can override.
                    "+ Add new..." inline-create is deferred to a later slice. */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Client Type</label>
                  <select
                    value={draft.clientTypeId ?? 3}
                    onChange={(e) => setDraft({ ...draft, clientTypeId: Number(e.target.value) })}
                  >
                    {clientTypes.length === 0
                      ? <option value={3}>NetworkPartner</option>
                      : clientTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                    }
                  </select>
                  <span className="text-xs text-text-muted">
                    Determines how this NP's tucClient row is classified for billing / Hub visibility. Defaults to NetworkPartner.
                  </span>
                </div>
              </>
            )}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Coverage Areas</label>
              <div className="flex flex-wrap gap-1.5">
                {(draft.coverageAreas ?? []).map((area) => {
                  // Phase 5+29b §C — find matching backend-resolved details for
                  // this chip (zip count + hasZipMapping). Falls back to a
                  // zero-count "pending" state for chips added in this session
                  // before save (details only land on the read after save).
                  const detail = (draft.coverageAreaDetails ?? []).find(
                    (d) => d.areaName.toLowerCase() === area.toLowerCase(),
                  );
                  const hasZips = detail ? detail.hasZipMapping : null;
                  const chipStyle = hasZips === false
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-700';
                  return (
                    <span
                      key={area}
                      title={
                        detail
                          ? hasZips
                            ? `${detail.zipCount} zipcodes mapped from ZipPolygonCity seed`
                            : 'No zips mapped — operator-typed city not in the ZipPolygonCity seed. Downstream zip-based filtering will see nothing from this entry until the seed is updated.'
                          : 'New entry — zip count appears after save'
                      }
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${chipStyle}`}
                    >
                      {area}
                      {detail && (
                        <span className="text-[10px] opacity-70">
                          {hasZips ? `(${detail.zipCount})` : '(no zips)'}
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${area}`}
                        onClick={() => setDraft({
                          ...draft,
                          coverageAreas: (draft.coverageAreas ?? []).filter((a) => a !== area),
                          // Drop the matching detail too so the next render is consistent.
                          coverageAreaDetails: (draft.coverageAreaDetails ?? []).filter(
                            (d) => d.areaName.toLowerCase() !== area.toLowerCase(),
                          ),
                        })}
                        className="text-current opacity-50 hover:opacity-100 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                {(draft.coverageAreas ?? []).length === 0 && (
                  <span className="text-xs text-text-muted">No coverage areas yet.</span>
                )}
              </div>
              {/* Phase 5+29b §C — debounced city autocomplete. Backend's
                  /lookups/cities filters ZipPolygonCity by prefix and surfaces
                  the zip count per suggestion. Operator picks one → city name
                  added; Enter / Add still works for free-text (soft-fail path,
                  yellow badge after save). */}
              <div className="relative mt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1"
                    placeholder="Start typing a city — suggestions appear below"
                    value={coverageInput}
                    onChange={(e) => { setCoverageInput(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCoverageArea(); } }}
                  />
                  <button
                    type="button"
                    onClick={() => addCoverageArea()}
                    className="bg-brand-cyan text-brand-dark border-none font-medium px-3 py-2 rounded-md text-sm hover:shadow-cyan-glow"
                  >
                    Add
                  </button>
                </div>
                {showSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 left-0 right-0 max-h-56 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
                    {citySuggestions.map((s) => (
                      <button
                        key={`${s.cityName}|${s.state ?? ''}`}
                        type="button"
                        onClick={() => addCoverageArea(s.cityName)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-cream"
                      >
                        <span className="text-text-primary">
                          {s.cityName}
                          {s.state && <span className="text-text-secondary">, {s.state}</span>}
                        </span>
                        <span className="text-xs text-text-muted">({s.zipCount} zips)</span>
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestions && coverageInput.trim().length >= 2 && citySuggestions.length === 0 && (
                  <div className="absolute z-10 mt-1 left-0 right-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-lg">
                    No cities found for "{coverageInput.trim()}". You can still Add it as free-text — it'll save with zero mapped zips (yellow badge) until the seed is updated.
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Notes</label>
              <textarea
                rows={3}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            ⚠️ {saveError}
          </div>
        )}
        <div className="flex gap-2.5 justify-end">
          <button
            onClick={closeModal}
            disabled={saving}
            className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !(draft?.name ?? '').trim()}
            className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50"
          >
            {saving ? 'Saving…' : createMode ? 'Create Agent' : 'Save Changes'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

