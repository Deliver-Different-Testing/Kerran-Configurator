import api from './tenant_api';

export interface ProspectAgent {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  association: string;
  specialties: string[];
  fleetSize: number | null;
  isVerified: boolean;
  convertedToAgent: boolean;
}

export const prospectService = {
  async search(params: { search?: string; association?: string }): Promise<ProspectAgent[]> {
    const { data } = await api.get<ProspectAgent[]>('/prospects', { params });
    return data ?? [];
  },

  async convert(id: number): Promise<{ agentId: number; agentName: string }> {
    const { data } = await api.post<{ agentId: number; agentName: string }>(`/prospects/${id}/convert`);
    return data;
  },
};
