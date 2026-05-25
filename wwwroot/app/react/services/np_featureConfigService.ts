// Per-NP feature toggles — DF-Admin-only. Backed by
// /api/v1/np/feature-config (Phase 5+26). NPs without an explicit
// NpFeatureConfig row are returned with hasConfigRow=false and schema
// defaults; first PUT promotes them to an explicit row.
import api from './np_api';
import type { NpFeatureConfig, NpFeatureConfigUpsert } from '@/types';

export const npFeatureConfigService = {
  async list(): Promise<NpFeatureConfig[]> {
    const { data } = await api.get<NpFeatureConfig[]>('/feature-config');
    return data ?? [];
  },

  async getByAgentId(agentId: number): Promise<NpFeatureConfig> {
    const { data } = await api.get<NpFeatureConfig>(`/feature-config/${agentId}`);
    return data;
  },

  async upsert(agentId: number, payload: NpFeatureConfigUpsert): Promise<NpFeatureConfig> {
    const { data } = await api.put<NpFeatureConfig>(`/feature-config/${agentId}`, payload);
    return data;
  },
};
