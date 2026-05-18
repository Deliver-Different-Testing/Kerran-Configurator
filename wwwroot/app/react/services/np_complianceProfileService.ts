// Compliance Profiles — live, backed by /api/v1/np/compliance-profiles
// (migration 030). Driver-compliance-status methods stay mock: there is no
// per-courier document-instance table yet.
import api from './np_api';
import { mockDriverComplianceStatuses } from './np_devData';
import type { ComplianceProfile, ComplianceRequirement, DriverComplianceStatus } from '@/types';

export interface RecruitmentConfig {
  recruitmentViewMode: 'full_pipeline' | 'ready_for_review';
  visibleStages?: string[];
}

let recruitmentConfig: RecruitmentConfig = { recruitmentViewMode: 'full_pipeline' };

// Backend shapes — NpComplianceProfileDto / NpComplianceRequirementDto.
interface RequirementApi {
  id: number;
  profileId: number;
  documentTypeId: number;
  documentTypeName: string;
  purpose: string;
  mandatory: boolean;
  sortOrder: number;
  quizRequired: boolean;
  quizId: number | null;
}

interface ComplianceProfileApi {
  id: number;
  name: string;
  description: string;
  isDefault: boolean;
  active: boolean;
  clientNames: string[];
  requirements: RequirementApi[];
  createdDate: string;
  modifiedDate: string | null;
}

function toRequirement(r: RequirementApi): ComplianceRequirement {
  return {
    id: r.id,
    profileId: r.profileId,
    documentTypeId: r.documentTypeId,
    documentTypeName: r.documentTypeName,
    purpose: (r.purpose || 'Compliance') as ComplianceRequirement['purpose'],
    mandatory: r.mandatory,
    sortOrder: r.sortOrder,
    quizRequired: r.quizRequired,
    quizId: r.quizId ?? undefined,
  };
}

function toProfile(p: ComplianceProfileApi): ComplianceProfile {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    isDefault: p.isDefault,
    tenantId: 1,                          // per-tenant DB — no real tenant id
    clientNames: p.clientNames ?? [],
    clientName: (p.clientNames && p.clientNames[0]) || undefined,
    requirements: (p.requirements ?? []).map(toRequirement),
    createdDate: p.createdDate,
    modifiedDate: p.modifiedDate ?? undefined,
    active: p.active,
  };
}

// Partial<ComplianceProfile> → NpComplianceProfileUpsertDto. clientNames falls
// back to the legacy single clientName; requirement order falls back to index.
function toUpsert(p: Partial<ComplianceProfile>) {
  const clientNames = p.clientNames && p.clientNames.length > 0
    ? p.clientNames
    : (p.clientName ? [p.clientName] : []);
  return {
    name: p.name ?? '',
    description: p.description ?? '',
    isDefault: !!p.isDefault,
    active: p.active ?? true,
    clientNames,
    requirements: (p.requirements ?? []).map((r, idx) => ({
      documentTypeId: r.documentTypeId,
      mandatory: r.mandatory,
      sortOrder: r.sortOrder ?? idx,
      quizRequired: !!r.quizRequired,
      quizId: r.quizId ?? null,
    })),
  };
}

export const complianceProfileService = {
  async getAll(): Promise<ComplianceProfile[]> {
    const { data } = await api.get<ComplianceProfileApi[]>('/compliance-profiles');
    return (data ?? []).map(toProfile);
  },

  async getById(id: number): Promise<ComplianceProfile | undefined> {
    const all = await complianceProfileService.getAll();
    return all.find(p => p.id === id);
  },

  async create(profile: Partial<ComplianceProfile>): Promise<ComplianceProfile> {
    const { data } = await api.post<ComplianceProfileApi>('/compliance-profiles', toUpsert(profile));
    return toProfile(data);
  },

  async update(id: number, updates: Partial<ComplianceProfile>): Promise<ComplianceProfile> {
    const { data } = await api.put<ComplianceProfileApi>(`/compliance-profiles/${id}`, toUpsert(updates));
    return toProfile(data);
  },

  // Soft delete — the backend flips IsActive to false.
  async deactivate(id: number): Promise<void> {
    await api.delete(`/compliance-profiles/${id}`);
  },

  // Driver compliance status / eligibility needs per-courier document
  // instances — no table for those yet, so these stay mock / empty.
  getDriverStatuses(): DriverComplianceStatus[] {
    return mockDriverComplianceStatuses;
  },
  getDriverStatus(courierId: number): DriverComplianceStatus | undefined {
    return mockDriverComplianceStatuses.find(s => s.courierId === courierId);
  },
  getEligibleDriverCount(_profileId: number): number {
    return 0;
  },

  getRecruitmentConfig(): RecruitmentConfig {
    return recruitmentConfig;
  },
  setRecruitmentConfig(config: RecruitmentConfig): void {
    recruitmentConfig = config;
  },
};
