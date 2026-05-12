import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAgents as useLiveAgents } from '@/hooks/useAgents';
import { tenantDashboardService, TenantDashboardStats } from '@/services/tenant_dashboardService';

const recentActivity = [
  { id: 1, type: 'agent_added', description: 'Metro Express Couriers added via CLDA import', time: '2 hours ago' },
  { id: 2, type: 'np_activated', description: 'Lone Star Logistics activated as Network Partner', time: '5 hours ago' },
  { id: 3, type: 'quote_received', description: 'New quote received for Dallas Same-Day posting', time: '1 day ago' },
  { id: 4, type: 'onboarding_started', description: 'Rapid Delivery Co. onboarding in progress', time: '1 day ago' },
  { id: 5, type: 'np_activated', description: 'Capital Couriers promoted to Multi-Client tier', time: '2 days ago' },
];

const typeIcons: Record<string, string> = {
  agent_added: '🏢',
  np_activated: '🤝',
  quote_received: '📨',
  onboarding_started: '📋',
};

// Recent NPs — top 5 network partners by most-recent activity. Replaces the
// previous mock "Bottom 5 Performers" which depended on per-agent OTD rate
// (not yet available in live data).
function useRecentNps() {
  const { agents } = useLiveAgents();
  return [...agents]
    .filter((a) => a.isNetworkPartner)
    .sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime())
    .slice(0, 5)
    .map((a) => ({ id: a.id, name: a.name, tier: a.npTier ?? 'Base', updated: a.updatedDate }));
}

type CoverageStatus = 'Full' | 'Partial' | 'At Risk';

const coverageStatusColors: Record<CoverageStatus, string> = {
  Full: 'bg-green-100 text-green-700',
  Partial: 'bg-amber-100 text-amber-700',
  'At Risk': 'bg-red-100 text-red-700',
};

const capacityByMarket = [
  { market: 'Dallas–Fort Worth', drivers: 42, vehicleMix: '18 vans, 14 cars, 10 bikes', programApprovals: 'Marken ✓, ARUP ✓, STA ✓', coverageStatus: 'Full' as CoverageStatus },
  { market: 'Chicago Metro', drivers: 38, vehicleMix: '20 vans, 12 cars, 6 bikes', programApprovals: 'Marken ✓, ARUP ✓, STA ✗', coverageStatus: 'Partial' as CoverageStatus },
  { market: 'Houston', drivers: 29, vehicleMix: '15 vans, 10 cars, 4 trucks', programApprovals: 'Marken ✓, ARUP ✗, STA ✗', coverageStatus: 'At Risk' as CoverageStatus },
  { market: 'Phoenix', drivers: 21, vehicleMix: '10 vans, 8 cars, 3 bikes', programApprovals: 'Marken ✓, ARUP ✓, STA ✓', coverageStatus: 'Full' as CoverageStatus },
  { market: 'Denver', drivers: 17, vehicleMix: '8 vans, 6 cars, 3 trucks', programApprovals: 'Marken ✗, ARUP ✗, STA ✗', coverageStatus: 'At Risk' as CoverageStatus },
];

// Live Compliance Risk card. Real risk scoring needs migrations 006-007
// (compliance profiles + courier/agent document expiry tracking) which
// haven't landed yet, so for now we show the NP roster + a clear "data not
// yet wired" placeholder rather than fake risk badges.
function ComplianceRiskCard() {
  const { agents, loading } = useLiveAgents();
  const nps = agents.filter((a) => a.isNetworkPartner);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-text-primary">Compliance Risk</h2>
        <Link to="/compliance" className="text-sm font-medium text-brand-cyan hover:underline">View All →</Link>
      </div>
      <div className="flex gap-4 mb-4 text-sm">
        <div>
          <span className="font-bold text-text-primary">{loading ? '—' : nps.length}</span>
          <span className="ml-1 text-text-secondary">Network Partners</span>
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        Per-agent compliance scoring isn't wired yet. Lands when migrations 006 (document types) and 007 (compliance profiles) are imported. Until then this card shows the NP roster only.
      </div>
      <div className="mt-3 space-y-2">
        {nps.slice(0, 5).map((agent) => (
          <div key={agent.id} className="flex items-center justify-between text-sm">
            <span className="text-text-primary truncate mr-2">{agent.name}</span>
            <span className="text-xs text-text-muted">{agent.npTier ?? 'Base'} NP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function daysSince(iso: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const recentNps = useRecentNps();
  const [stats, setStats] = useState<TenantDashboardStats | null>(null);

  useEffect(() => {
    let alive = true;
    tenantDashboardService.getStats().then(s => { if (alive) setStats(s); });
    return () => { alive = false; };
  }, []);

  // While stats are loading, show em-dashes rather than zeros so it's
  // obvious the numbers haven't resolved yet.
  const otd = stats == null ? '—' : `${stats.otdRate.toFixed(1)}%`;
  const exc = stats == null ? '—' : `${stats.exceptionRate.toFixed(1)}%`;
  const volume = stats == null ? '—' : stats.monthlyVolume.toLocaleString();
  const billing = stats == null ? '—' : stats.monthlyNpBilling;
  const coverage = stats == null ? '—' : stats.marketCoverage.toString();

  return (
    <div>
      {/* NP Scorecard Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* OTD Rate */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-xs uppercase tracking-wide text-text-muted font-medium">On-Time Delivery Rate</div>
          <div className="mt-2 text-4xl font-bold text-success">{otd}</div>
          <div className="mt-1 text-xs text-text-secondary">Last 30 days</div>
        </div>

        {/* Exception Rate */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-xs uppercase tracking-wide text-text-muted font-medium">Exception Rate</div>
          <div className="mt-2 text-4xl font-bold text-warning">{exc}</div>
          <div className="mt-1 text-xs text-text-secondary">Last 30 days</div>
        </div>

        {/* Monthly Volume */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-xs uppercase tracking-wide text-text-muted font-medium">Monthly Volume</div>
          <div className="mt-2 text-4xl font-bold text-brand-cyan">{volume}</div>
          <div className="mt-1 text-xs text-text-secondary">Deliveries this month</div>
        </div>

        {/* Monthly NP Billing */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-xs uppercase tracking-wide text-text-muted font-medium">Monthly NP Billing</div>
          <div className="mt-2 text-4xl font-bold text-brand-purple">{billing}</div>
          <div className="mt-1 text-xs text-text-secondary">Across all network partners</div>
        </div>

        {/* Coverage */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-xs uppercase tracking-wide text-text-muted font-medium">Market Coverage</div>
          <div className="mt-2 text-4xl font-bold text-brand-cyan">{coverage}</div>
          <div className="mt-1 text-xs text-text-secondary">Active markets</div>
        </div>

        {/* Recent NPs (replaces "Bottom 5 Performers" — per-agent OTD rate
            is not yet wired in our live data, so we surface the most-recently-
            updated NP roster instead. Click a row to open the agent's detail. */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-xs uppercase tracking-wide text-text-muted font-medium">Recent Network Partners</div>
          {recentNps.length === 0 ? (
            <div className="mt-2 text-xs text-text-muted">No network partners yet.</div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {recentNps.map((np) => (
                <div key={np.id} onClick={() => navigate(`/agents/${np.id}`)} className="flex items-center justify-between text-sm cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 transition-colors">
                  <span className="text-text-primary truncate mr-2">{np.name}</span>
                  <span className="text-xs text-text-muted flex-shrink-0">{daysSince(np.updated)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compliance Risk Card */}
      <div className="mb-6">
        <ComplianceRiskCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Quick Actions</h2>
          <div className="flex flex-col gap-3">
            <Link
              to="/agents/find"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-brand-cyan/5 hover:bg-brand-cyan/10 transition-colors"
            >
              <span className="text-xl">🤖</span>
              <div>
                <div className="text-sm font-bold text-text-primary">Find/Add New</div>
                <div className="text-xs text-text-muted">Search association directories or create a new partner record</div>
              </div>
            </Link>
            <Link
              to="/agents/onboarding"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-success/5 hover:bg-success/10 transition-colors"
            >
              <span className="text-xl">➕</span>
              <div>
                <div className="text-sm font-bold text-text-primary">Agent/NP Onboarding</div>
                <div className="text-xs text-text-muted">Create a partner record and move it through onboarding</div>
              </div>
            </Link>
            <Link
              to="/quotes"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-brand-purple/5 hover:bg-brand-purple/10 transition-colors"
            >
              <span className="text-xl">📨</span>
              <div>
                <div className="text-sm font-bold text-text-primary">Post Quote Request</div>
                <div className="text-xs text-text-muted">Broadcast to quotes</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Capacity by Market */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Coverage / Capacity by Area</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-light">
                  <th className="px-3 py-2.5 text-left font-semibold text-text-muted">Market</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-text-muted">Active Drivers</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-text-muted">Vehicle Mix</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-text-muted">Program Approvals</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-text-muted">Coverage Status</th>
                </tr>
              </thead>
              <tbody>
                {capacityByMarket.map((m) => (
                  <tr key={m.market} className="border-t border-border hover:bg-surface-light/50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-text-primary">{m.market}</td>
                    <td className="px-3 py-2.5 font-bold text-brand-cyan">{m.drivers}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{m.vehicleMix}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{m.programApprovals}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${coverageStatusColors[m.coverageStatus]}`}>
                        {m.coverageStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Recent Activity</h2>
          <div className="flex flex-col gap-3">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{typeIcons[item.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary">{item.description}</div>
                  <div className="text-xs text-text-muted">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
