import api from './tenant_api';

export interface TenantDashboardStats {
  otdRate: number;
  exceptionRate: number;
  monthlyVolume: number;
  monthlyNpBilling: string;
  marketCoverage: number;
}

const EMPTY_STATS: TenantDashboardStats = {
  otdRate: 0,
  exceptionRate: 0,
  monthlyVolume: 0,
  monthlyNpBilling: '$0',
  marketCoverage: 0,
};

export const tenantDashboardService = {
  async getStats(): Promise<TenantDashboardStats> {
    const { data } = await api.get<TenantDashboardStats>('/dashboard');
    return data ?? EMPTY_STATS;
  },
};
