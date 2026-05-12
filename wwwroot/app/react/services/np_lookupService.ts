import api from './np_api';

export interface LookupItem {
  id: number;
  name: string;
}

export const lookupService = {
  async getVehicleMakes(): Promise<LookupItem[]> {
    const { data } = await api.get<LookupItem[]>('/lookups/vehicle-makes');
    return data ?? [];
  },

  async getInsuranceCompanies(): Promise<LookupItem[]> {
    const { data } = await api.get<LookupItem[]>('/lookups/insurance-companies');
    return data ?? [];
  },
};
