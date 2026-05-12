import api from './np_api';

export interface DashboardStats {
  activeCouriers: number;
  jobsToday: number;
  completed: number;
  revenueThisWeek: string;
  agentName?: string | null;
  agentInitials?: string | null;
  agentTier?: string | null;
}

export interface ActivityFeedItem {
  time: string;
  description: string;
}

const EMPTY_STATS: DashboardStats = {
  activeCouriers: 0,
  jobsToday: 0,
  completed: 0,
  revenueThisWeek: '$0',
};

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const { data } = await api.get<DashboardStats>('/dashboard');
    return data ?? EMPTY_STATS;
  },

  async getComplianceAlerts(): Promise<number> {
    const { data } = await api.get<{ expiringCount?: number }>('/compliance/dashboard');
    return data?.expiringCount ?? 0;
  },

  async getActivityFeed(): Promise<ActivityFeedItem[]> {
    const { data } = await api.get<ActivityFeedItem[]>('/dashboard/activity');
    return data ?? [];
  },
};
