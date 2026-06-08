import api from './tenant_api';

// Agent/NP Onboarding pipeline — real API service. Replaces the demo-only
// agentOnboardingData seed + in-memory store (GARRY-AGENT-NP-ONBOARDING-REMOVE-
// DUMMY-DATA). Owns the onboarding types/constants that used to live in
// agentOnboardingData.ts (now deleted).

export type BusinessOnboardingStage =
  | 'Prospect Identified'
  | 'Contacted'
  | 'Qualified'
  | 'Documents Requested'
  | 'Documents Received'
  | 'Review In Progress'
  | 'Approved'
  | 'Activated'
  | 'Rejected / Archived';

export interface ComplianceItem {
  id: string;
  label: string;
  status: 'complete' | 'in_progress' | 'missing';
  updatedAt: string;
}

export interface TimelineItem {
  id: string;
  title: string;
  detail: string;
  owner: string;
  timestamp: string;
}

export interface BusinessOnboardingRecord {
  id: number;
  linkedAgentId?: number;
  businessName: string;
  primaryContact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  coverage: string[];
  association: 'ECA' | 'CLDA' | 'None';
  memberId?: string;
  source: 'Directory Search' | 'Referral' | 'Outbound' | 'Manual Entry' | 'Imported Lead';
  stage: BusinessOnboardingStage;
  networkPartnerStatus: 'Candidate' | 'Approved NP' | 'Agent Only' | 'Archived';
  fleetProfile: string;
  estimatedDrivers: number;
  serviceCapabilities: string[];
  specialties: string[];
  notes: string;
  complianceItems: ComplianceItem[];
  complianceComplete: boolean;
  timeline: TimelineItem[];
  reviewer: string;
  owner: string;
  lastUpdated: string;
  createdAt: string;
  archived: boolean;
}

export const BUSINESS_ONBOARDING_STAGES: BusinessOnboardingStage[] = [
  'Prospect Identified',
  'Contacted',
  'Qualified',
  'Documents Requested',
  'Documents Received',
  'Review In Progress',
  'Approved',
  'Activated',
  'Rejected / Archived',
];

export const STAGE_TONE: Record<BusinessOnboardingStage, string> = {
  'Prospect Identified': 'bg-sky-100 text-sky-700',
  Contacted: 'bg-indigo-100 text-indigo-700',
  Qualified: 'bg-violet-100 text-violet-700',
  'Documents Requested': 'bg-amber-100 text-amber-700',
  'Documents Received': 'bg-orange-100 text-orange-700',
  'Review In Progress': 'bg-cyan-100 text-cyan-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Activated: 'bg-green-100 text-green-700',
  'Rejected / Archived': 'bg-slate-200 text-slate-700',
};

// Payload the create form sends (the backend fills defaults for the rest).
export interface CreateOnboardingPayload {
  businessName: string;
  primaryContact: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  association: BusinessOnboardingRecord['association'];
  memberId: string;
  source: BusinessOnboardingRecord['source'];
  notes: string;
  networkPartnerStatus: Extract<BusinessOnboardingRecord['networkPartnerStatus'], 'Candidate' | 'Agent Only'>;
}

// Backend shape — kept in sync with TenantAgentOnboardingDetailDto (camelCase).
interface OnboardingComplianceApi { requirementKey: string; label: string; status: string; updatedAt: string | null; notes: string; }
interface OnboardingTimelineApi { id: number; title: string; detail: string; owner: string; eventAt: string; }
interface OnboardingApi {
  id: number;
  linkedAgentId: number | null;
  businessName: string;
  primaryContact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  coverage: string[];
  association: string;
  memberId: string;
  source: string;
  stage: string;
  networkPartnerStatus: string;
  fleetProfile: string;
  estimatedDrivers: number;
  serviceCapabilities: string[];
  specialties: string[];
  notes: string;
  complianceItems: OnboardingComplianceApi[];
  complianceComplete: boolean;
  timeline: OnboardingTimelineApi[];
  reviewer: string;
  owner: string;
  archived: boolean;
  lastUpdated: string;
  createdAt: string;
}

function toRecord(dto: OnboardingApi): BusinessOnboardingRecord {
  return {
    id: dto.id,
    linkedAgentId: dto.linkedAgentId ?? undefined,
    businessName: dto.businessName,
    primaryContact: dto.primaryContact,
    phone: dto.phone,
    email: dto.email,
    address: dto.address,
    city: dto.city,
    state: dto.state,
    coverage: dto.coverage ?? [],
    association: (['ECA', 'CLDA', 'None'].includes(dto.association) ? dto.association : 'None') as BusinessOnboardingRecord['association'],
    memberId: dto.memberId || undefined,
    source: dto.source as BusinessOnboardingRecord['source'],
    stage: dto.stage as BusinessOnboardingStage,
    networkPartnerStatus: dto.networkPartnerStatus as BusinessOnboardingRecord['networkPartnerStatus'],
    fleetProfile: dto.fleetProfile,
    estimatedDrivers: dto.estimatedDrivers,
    serviceCapabilities: dto.serviceCapabilities ?? [],
    specialties: dto.specialties ?? [],
    notes: dto.notes,
    complianceItems: (dto.complianceItems ?? []).map((c) => ({
      id: c.requirementKey,
      label: c.label,
      status: (c.status as ComplianceItem['status']) ?? 'missing',
      updatedAt: c.updatedAt ?? '',
    })),
    complianceComplete: dto.complianceComplete,
    timeline: (dto.timeline ?? []).map((t) => ({
      id: String(t.id),
      title: t.title,
      detail: t.detail,
      owner: t.owner,
      timestamp: t.eventAt,
    })),
    reviewer: dto.reviewer,
    owner: dto.owner,
    lastUpdated: dto.lastUpdated,
    createdAt: dto.createdAt,
    archived: dto.archived,
  };
}

function toUpsertPayload(input: CreateOnboardingPayload) {
  return {
    businessName: input.businessName,
    primaryContact: input.primaryContact,
    phone: input.phone,
    email: input.email,
    address: '',
    city: input.city,
    state: input.state,
    coverage: [] as string[],
    association: input.association,
    memberId: input.memberId,
    source: input.source,
    networkPartnerStatus: input.networkPartnerStatus,
    fleetProfile: '',
    estimatedDrivers: 0,
    serviceCapabilities: [] as string[],
    specialties: [] as string[],
    notes: input.notes,
    reviewer: '',
    owner: '',
  };
}

export const onboardingService = {
  list: async (): Promise<BusinessOnboardingRecord[]> => {
    const { data } = await api.get<OnboardingApi[]>('/agents/onboarding');
    return (data ?? []).map(toRecord);
  },
  get: async (id: number): Promise<BusinessOnboardingRecord> => {
    const { data } = await api.get<OnboardingApi>(`/agents/onboarding/${id}`);
    return toRecord(data);
  },
  create: async (payload: CreateOnboardingPayload): Promise<BusinessOnboardingRecord> => {
    const { data } = await api.post<OnboardingApi>('/agents/onboarding', toUpsertPayload(payload));
    return toRecord(data);
  },
  advanceStage: async (id: number): Promise<BusinessOnboardingRecord> => {
    const { data } = await api.post<OnboardingApi>(`/agents/onboarding/${id}/advance-stage`);
    return toRecord(data);
  },
  approveActivate: async (id: number): Promise<BusinessOnboardingRecord> => {
    const { data } = await api.post<OnboardingApi>(`/agents/onboarding/${id}/approve-activate`);
    return toRecord(data);
  },
  archive: async (id: number): Promise<BusinessOnboardingRecord> => {
    const { data } = await api.post<OnboardingApi>(`/agents/onboarding/${id}/archive`);
    return toRecord(data);
  },
};
