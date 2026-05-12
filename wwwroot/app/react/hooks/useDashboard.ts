import { useEffect, useState } from 'react';
import { dashboardService, DashboardStats, ActivityFeedItem } from '@/services/np_dashboardService';

const INITIAL_STATS: DashboardStats = {
  activeCouriers: 0,
  jobsToday: 0,
  completed: 0,
  revenueThisWeek: '$0',
};

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [complianceAlerts, setComplianceAlerts] = useState(0);
  const [activity, setActivity] = useState<ActivityFeedItem[]>([]);

  useEffect(() => {
    let alive = true;
    dashboardService.getStats().then(s => { if (alive) setStats(s); });
    dashboardService.getComplianceAlerts().then(n => { if (alive) setComplianceAlerts(n); });
    dashboardService.getActivityFeed().then(a => { if (alive) setActivity(a); });
    return () => { alive = false; };
  }, []);

  return { stats, complianceAlerts, activity };
}
