import api from './np_api';
import tenantApi from './tenant_api';

export interface LookupItem {
  id: number;
  name: string;
}

// Shape of /api/v1/tenant/agents. We only need the three fields used by
// the Network Partner picker — the full TenantAgentApi type lives in
// tenant_agentService.ts but importing it just for this would create a
// circular dependency.
interface TenantAgentRow {
  id: number;
  name: string;
  isNetworkPartner: boolean;
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

  // Network Partner picker source — reuses the existing tenant agents
  // endpoint and filters down to the rows flagged as NP. Only called from
  // the DF Admin / Tenant Admin branch of the courier detail page; NP
  // users render a read-only field and skip this lookup entirely.
  async getNetworkPartners(): Promise<LookupItem[]> {
    const { data } = await tenantApi.get<TenantAgentRow[]>('/agents');
    return (data ?? [])
      .filter(a => a.isNetworkPartner)
      .map(a => ({ id: a.id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};
