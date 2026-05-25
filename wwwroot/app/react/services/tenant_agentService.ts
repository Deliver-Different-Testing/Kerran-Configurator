import api from './tenant_api';
import type { Agent, AgentStatus, AssociationType, NpTier } from '@/types';

// Backend shape — kept in sync with TenantAgentDto. Pass 3 added city,
// statusName, rankingName via lookup joins; Pass 4 added state plus the
// association / contact / pay-percent columns (migration 029).
interface TenantAgentApi {
  id: number;
  name: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  postCode: string;
  statusId: number | null;
  statusName: string;
  rankingId: number | null;
  rankingName: string;
  isNetworkPartner: boolean;
  npPortalEnabled: boolean;
  npTier: number;
  notes: string;
  association: string;
  associationMemberId: string;
  contactName: string;
  contactEmail: string;
  defaultCourierPayPercent: number | null;
  // Phase 5+29a §C — was string[], now backend returns richer shape so
  // the chip can render "Sacramento (42)" once the UI catches up in 5+29b.
  // For now we map back to string[] in toAgent() to keep the existing
  // Agent type + AgentList chip render compatible.
  coverageAreas: TenantAgentCoverageAreaApi[];
  // Phase 5+27.1 — linked TucClient.ClientTypeId surfaced for the picker.
  // Null for non-NP agents (no TucClient linkage).
  clientTypeId: number | null;
  created: string;
  lastModified: string;
}

interface TenantAgentCoverageAreaApi {
  areaName: string;
  zipCount: number;
  hasZipMapping: boolean;
}

// '' / unknown → 'None'; otherwise pass through the known association codes.
function normaliseAssociation(value: string): AssociationType {
  const v = (value ?? '').trim().toUpperCase();
  if (v === 'ECA') return 'ECA';
  if (v === 'CLDA') return 'CLDA';
  return 'None';
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
// Pass 3: city/status/ranking from real lookups. Pass 4: state, association,
// contact name/email and default courier pay % all populated from migration-029
// columns. coverageAreas still [] — pending the AgentCoverageArea table scaffold;
// otdRate/clientsServiced/approvedPrograms still need their own sources.
function toAgent(dto: TenantAgentApi): Agent {
  return {
    id: dto.id,
    name: dto.name,
    contactName: dto.contactName ?? '',
    phone: dto.phone,
    email: dto.contactEmail ?? '',
    address: dto.addressLine1,
    city: dto.city,
    state: dto.state ?? '',
    postCode: dto.postCode,
    country: 'US',
    gps: null,
    status: normaliseStatus(dto.statusName),
    ranking: dto.rankingId ?? 0,
    notes: dto.notes,
    association: normaliseAssociation(dto.association),
    associationMemberId: dto.associationMemberId ?? '',
    isNetworkPartner: dto.isNetworkPartner,
    npTier: npTierFromByte(dto.npTier, dto.isNetworkPartner),
    npActivatedDate: null,
    // Phase 5+29a §C — backend now returns rich shape; reduce to names
    // for current chip render. 5+29b will lift this to the rich shape +
    // surface zipCount / hasZipMapping in the AgentList chip.
    coverageAreas: (dto.coverageAreas ?? []).map(a => a.areaName),
    defaultCourierPayPercent: dto.defaultCourierPayPercent ?? null,
    createdDate: dto.created,
    updatedDate: dto.lastModified,
    statusId: dto.statusId ?? undefined,
    rankingId: dto.rankingId,
    npPortalEnabled: dto.npPortalEnabled,
    npTierByte: dto.npTier,
    clientTypeId: dto.clientTypeId ?? null,
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
    // Pass-4 fields. 'None' is stored as an empty string server-side.
    association: a.association && a.association !== 'None' ? a.association : '',
    associationMemberId: a.associationMemberId ?? '',
    contactName: a.contactName ?? '',
    contactEmail: a.email ?? '',
    defaultCourierPayPercent: a.defaultCourierPayPercent ?? null,
    coverageAreas: a.coverageAreas ?? [],
    // Phase 5+27.1 — operator-selectable ClientType for the linked TucClient.
    // Backend defaults to 3 (NetworkPartner) when null + IsNetworkPartner=true.
    clientTypeId: a.clientTypeId ?? null,
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
  // Phase 5+27.1 — ClientType lookup for the Add/Edit Agent picker.
  async getClientTypes(): Promise<LookupItem[]> {
    const { data } = await api.get<LookupItem[]>('/lookups/client-types');
    return data ?? [];
  },
};
