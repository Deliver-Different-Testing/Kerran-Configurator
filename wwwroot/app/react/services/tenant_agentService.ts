import api from './tenant_api';
import type { Agent, AgentStatus, NpTier } from '@/types';

// Backend shape — kept in sync with TenantAgentDto. Pass 3 added city,
// statusName, rankingName via lookup joins.
interface TenantAgentApi {
  id: number;
  name: string;
  phone: string;
  addressLine1: string;
  city: string;
  postCode: string;
  statusId: number | null;
  statusName: string;
  rankingId: number | null;
  rankingName: string;
  isNetworkPartner: boolean;
  npPortalEnabled: boolean;
  npTier: number;
  notes: string;
  created: string;
  lastModified: string;
}

function npTierFromByte(value: number, isNp: boolean): NpTier | null {
  if (!isNp) return null;
  if (value === 2) return 'Multi-Client';
  return 'Base';
}

// AgentStatus is a known string union in our types. The DB-side AgentStatusName
// can be anything operations have configured — most legacy values match
// (Active / Inactive / Pending / Suspended). Anything outside the known set
// we pass through as-is; getAgentStatusTone() falls back to a default tone.
const KNOWN_STATUSES: ReadonlyArray<AgentStatus> = ['Active', 'Inactive', 'Pending', 'Suspended', 'Potential', 'Pending NP', 'Archived'];

function normaliseStatus(name: string): AgentStatus {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'Active';
  const match = KNOWN_STATUSES.find(s => s.toLowerCase() === trimmed.toLowerCase());
  return match ?? (trimmed as AgentStatus);
}

// Map the lean backend shape into the rich Agent type the React pages consume.
// Pass 3: city/status/ranking populated from real lookups. ContactName,
// state, association, otdRate, clientsServiced, approvedPrograms still on
// safe defaults — those need separate sources or schema additions.
function toAgent(dto: TenantAgentApi): Agent {
  return {
    id: dto.id,
    name: dto.name,
    contactName: '',
    phone: dto.phone,
    email: '',
    address: dto.addressLine1,
    city: dto.city,
    state: '',
    postCode: dto.postCode,
    country: 'US',
    gps: null,
    status: normaliseStatus(dto.statusName),
    ranking: dto.rankingId ?? 0,
    notes: dto.notes,
    association: 'None',
    associationMemberId: '',
    isNetworkPartner: dto.isNetworkPartner,
    npTier: npTierFromByte(dto.npTier, dto.isNetworkPartner),
    npActivatedDate: null,
    coverageAreas: [],
    defaultCourierPayPercent: null,
    createdDate: dto.created,
    updatedDate: dto.lastModified,
    statusId: dto.statusId ?? undefined,
    rankingId: dto.rankingId,
    npPortalEnabled: dto.npPortalEnabled,
    npTierByte: dto.npTier,
    // ExtAgent extras (optional on the type) — empty defaults keep
    // AgentWorkspace happy until the relevant joins / tables exist.
    npDocs: [],
    clientsServiced: [],
    approvedPrograms: [],
  } as Agent;
}

// Inverse of toAgent — strips down to the editable fields the backend accepts.
function toUpsertPayload(a: Partial<Agent>) {
  return {
    name: a.name ?? '',
    phone: a.phone ?? '',
    addressLine1: a.address ?? '',
    postCode: a.postCode ?? '',
    // Treat 0 the same as null — agents with no status legitimately exist
    // and the FK on tucAgents.StatusId rejects 0.
    statusId: a.statusId && a.statusId !== 0 ? a.statusId : null,
    rankingId: a.rankingId && a.rankingId !== 0 ? a.rankingId : null,
    isNetworkPartner: !!a.isNetworkPartner,
    npPortalEnabled: !!a.npPortalEnabled,
    npTier: a.npTierByte ?? 1,
    notes: a.notes ?? '',
  };
}

export const agentService = {
  // Returns AxiosResponse<Agent[]> — the existing useAgents hook unwraps via res.data.
  // The transformation from lean DTO → rich Agent happens here so consumers see
  // the same shape the mocks used to provide.
  list: async (_params?: { search?: string; status?: string; association?: string; isNp?: boolean }) => {
    const res = await api.get<TenantAgentApi[]>('/agents');
    return { ...res, data: (res.data ?? []).map(toAgent) };
  },

  get: async (id: number) => {
    const res = await api.get<TenantAgentApi>(`/agents/${id}`);
    return { ...res, data: toAgent(res.data) };
  },

  create: async (data: Partial<Agent>) => {
    const res = await api.post<TenantAgentApi>('/agents', toUpsertPayload(data));
    return { ...res, data: toAgent(res.data) };
  },

  update: async (id: number, data: Partial<Agent>) => {
    const res = await api.put<TenantAgentApi>(`/agents/${id}`, toUpsertPayload(data));
    return { ...res, data: toAgent(res.data) };
  },

  delete: (id: number) => api.delete(`/agents/${id}`),
};

export interface LookupItem {
  id: number;
  name: string;
}

export const tenantLookupService = {
  async getAgentStatuses(): Promise<LookupItem[]> {
    const { data } = await api.get<LookupItem[]>('/lookups/agent-statuses');
    return data ?? [];
  },
  async getAgentRankings(): Promise<LookupItem[]> {
    const { data } = await api.get<LookupItem[]>('/lookups/agent-rankings');
    return data ?? [];
  },
};
