import api from './tenant_api';
import type { Agent } from '@/types';

export const npService = {
  listNps: () => api.get<Agent[]>('/np'),

  getNp: (id: number) => api.get<Agent>(`/np/${id}`),

  activatePortal: (agentId: number) => api.post(`/np/${agentId}/activate`),

  deactivatePortal: (agentId: number) => api.post(`/np/${agentId}/deactivate`),

  updateSettings: (agentId: number, data: { coverageAreas?: string[]; defaultCourierPayPercent?: number }) =>
    api.put(`/np/${agentId}/settings`, data),
};
