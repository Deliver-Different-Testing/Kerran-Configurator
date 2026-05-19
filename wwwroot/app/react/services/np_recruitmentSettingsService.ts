// Recruitment Stages — live, backed by /api/v1/np/recruitment-stages
// (migration 031).
import api from './np_api';
import type { RecruitmentStageConfig } from '@/types';

interface RecruitmentStageApi {
  id: number;
  stageName: string;
  sortOrder: number;
  enabled: boolean;
  mandatory: boolean;
  description: string;
  createdDate: string;
}

function toStage(s: RecruitmentStageApi): RecruitmentStageConfig {
  return {
    id: s.id,
    tenantId: 1,                  // per-tenant DB — no real tenant id
    stageName: s.stageName,
    sortOrder: s.sortOrder,
    enabled: s.enabled,
    mandatory: s.mandatory,
    description: s.description || null,
    createdDate: s.createdDate,
  };
}

// Always send the full stage — the backend PUT replaces the row. The hook
// merges partial edits onto the existing stage before calling update.
function toUpsert(p: Partial<RecruitmentStageConfig>) {
  return {
    stageName: p.stageName ?? '',
    sortOrder: p.sortOrder ?? 0,
    enabled: p.enabled ?? true,
    mandatory: !!p.mandatory,
    description: p.description ?? '',
  };
}

export const recruitmentSettingsService = {
  async getStages(): Promise<RecruitmentStageConfig[]> {
    const { data } = await api.get<RecruitmentStageApi[]>('/recruitment-stages');
    return (data ?? []).map(toStage);
  },

  async createStage(stage: Partial<RecruitmentStageConfig>): Promise<RecruitmentStageConfig> {
    const { data } = await api.post<RecruitmentStageApi>('/recruitment-stages', toUpsert(stage));
    return toStage(data);
  },

  async updateStage(id: number, updates: Partial<RecruitmentStageConfig>): Promise<RecruitmentStageConfig> {
    const { data } = await api.put<RecruitmentStageApi>(`/recruitment-stages/${id}`, toUpsert(updates));
    return toStage(data);
  },

  async deleteStage(id: number): Promise<void> {
    await api.delete(`/recruitment-stages/${id}`);
  },

  // Restores any missing standard stages; returns the full refreshed list.
  async seedDefaults(): Promise<RecruitmentStageConfig[]> {
    const { data } = await api.post<RecruitmentStageApi[]>('/recruitment-stages/seed-defaults');
    return (data ?? []).map(toStage);
  },
};
