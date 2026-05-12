import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '@/hooks/useDashboard';
import { useComplianceDashboard } from '@/hooks/useCompliance';
import StatCard from '@/components/common/StatCard';
import QuickAction from '@/components/common/QuickAction';
import TierBadge from '@/components/common/TierBadge';

type DashTab = 'onboarding' | 'np' | 'approved';

interface Props {
  onUpgrade: () => void;
}

export default function Dashboard({ onUpgrade }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<DashTab>('np');
  const { stats, complianceAlerts, activity } = useDashboard();
  const { data: complianceDashboard } = useComplianceDashboard();

  const tabs: { key: DashTab; label: string; count?: number }[] = [
    { key: 'onboarding', label: 'On-boarding', count: 4 },
    { key: 'np', label: 'NP', count: stats.activeCouriers },
    { key: 'approved', label: 'Approved', count: 12 },
  ];

  return (
    <>
      {/* Top Tabs */}
      <div className="flex gap-0 border-b border-border mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[#3bc7f4] text-[#3bc7f4]'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-[#3bc7f4]/10 text-[#3bc7f4]' : 'bg-gray-100 text-text-secondary'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* On-boarding Tab */}
      {tab === 'onboarding' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="In Pipeline" value={4} color="cyan" />
            <StatCard label="Docs Pending" value={2} />
            <StatCard label="Training In Progress" value={1} color="green" />
            <StatCard label="Ready for Approval" value={1} />
          </div>
          <div className="bg-white border border-border rounded-lg p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Recruitment Pipeline</h3>
              <button onClick={() => navigate('/recruitment')} className="text-sm text-brand-cyan hover:underline">View All →</button>
            </div>
            <div className="space-y-2">
              {[
                { name: 'James Mitchell', stage: 'Documents', docs: '3/5', color: 'text-amber-600' },
                { name: 'Priya Sharma', stage: 'Training', docs: '5/5', color: 'text-blue-600' },
                { name: 'Tom Henderson', stage: 'Background Check', docs: '4/5', color: 'text-purple-600' },
                { name: 'Aroha Williams', stage: 'Ready for Review', docs: '5/5', color: 'text-green-600' },
              ].map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className={`ml-2 text-xs ${a.color}`}>● {a.stage}</span>
                  </div>
                  <span className="text-xs text-text-secondary">Docs: {a.docs}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <QuickAction icon="➕" label="Add Applicant" onClick={() => navigate('/recruitment')} />
            <QuickAction icon="📋" label="Compliance Docs" onClick={() => navigate('/compliance')} />
          </div>
        </>
      )}

      {/* NP Tab — existing dashboard */}
      {tab === 'np' && (
        <>
      {/* Welcome Card — only shown when the request has an NP scope. Admins
          viewing across NPs don't get a stale agent name. */}
      {stats.agentName && (
        <div className="bg-white border border-border rounded-lg p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-brand-cyan flex items-center justify-center text-2xl font-bold text-black">
              {stats.agentInitials || stats.agentName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold">Welcome back, {stats.agentName}</h2>
              <div className="text-text-secondary text-sm mt-1 flex items-center gap-3">
                <TierBadge tier={stats.agentTier} />
                {stats.agentTier !== 'Multi-Client' && (
                  <a href="#" onClick={(e) => { e.preventDefault(); onUpgrade(); }} className="text-xs text-brand-cyan hover:underline">
                    Upgrade to Multi Clients →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Couriers" value={stats.activeCouriers} color="cyan" />
        <StatCard label="Jobs Today" value={stats.jobsToday} />
        <StatCard label="Completed" value={stats.completed} color="green" />
        <StatCard label="Revenue This Week" value={stats.revenueThisWeek} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <QuickAction icon="→" label="View Dispatch Board" onClick={() => {/* DispatchWeb URL not configured */}} external />
        <QuickAction icon="➕" label="Add Courier" onClick={() => navigate('/fleet/add')} />
        <QuickAction icon="🚚" label="Fleet Overview" onClick={() => navigate('/fleet')} />
      </div>

      {/* Compliance Alert */}
      {complianceAlerts > 0 && (
        <div className="bg-amber-50 border border-[#854d0e] text-[#92400e] rounded-lg px-4 py-3.5 text-sm flex items-center gap-2.5 mb-3">
          ⚠️ {complianceAlerts} document(s) expiring within 30 days —{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/fleet'); }} className="text-brand-cyan hover:underline">
            Review compliance →
          </a>
        </div>
      )}

      {/* Compliance Summary Card */}
      {complianceDashboard && (
        <div
          onClick={() => navigate('/compliance')}
          className="bg-white border border-border rounded-lg p-5 mb-4 cursor-pointer hover:border-brand-cyan transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🛡️</div>
            <div className="flex-1">
              <h3 className="font-bold mb-1">Fleet Compliance</h3>
              <div className="flex items-center gap-4 text-sm text-text-secondary">
                <span>
                  Score: <strong className={
                    complianceDashboard.fleetCompliancePercent >= 80 ? 'text-green-600' :
                    complianceDashboard.fleetCompliancePercent >= 60 ? 'text-amber-600' : 'text-red-600'
                  }>{complianceDashboard.fleetCompliancePercent}%</strong>
                </span>
                {complianceDashboard.totalNonCompliant > 0 && (
                  <span className="text-red-600">{complianceDashboard.totalNonCompliant} non-compliant</span>
                )}
                {complianceDashboard.totalWarnings > 0 && (
                  <span className="text-amber-600">{complianceDashboard.totalWarnings} warning(s)</span>
                )}
                {complianceDashboard.urgentAlerts.length > 0 && (
                  <span>{complianceDashboard.urgentAlerts.length} alert(s)</span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/compliance'); }}
              className="text-brand-cyan text-sm font-medium hover:underline whitespace-nowrap"
            >
              View Dashboard →
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Card */}
      <div
        onClick={onUpgrade}
        className="bg-white border border-border rounded-lg p-5 mb-4 cursor-pointer hover:border-brand-cyan transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-4xl">🏢</div>
          <div className="flex-1">
            <h3 className="font-bold mb-1">Manage Deliveries for Multiple Clients</h3>
            <p className="text-text-secondary text-sm">
              You're currently delivering for 1 client. Upgrade to manage deliveries for additional clients — one fleet, multiple revenue streams.
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
            className="bg-brand-cyan text-brand-dark border-none font-medium px-6 py-3 rounded-md text-[15px] whitespace-nowrap hover:shadow-cyan-glow transition-opacity"
          >
            Upgrade to Multi Clients →
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white border border-border rounded-lg p-5">
        <h3 className="font-bold mb-3">Recent Activity</h3>
        {activity.map((item, i) => (
          <div key={i} className={`flex gap-3 py-2.5 text-[13px] ${i < activity.length - 1 ? 'border-b border-border' : ''}`}>
            <span className="text-text-secondary whitespace-nowrap min-w-[60px]">{item.time}</span>
            <span className="text-text-primary" dangerouslySetInnerHTML={{ __html: item.description }} />
          </div>
        ))}
      </div>
        </>
      )}

      {/* Approved Tab */}
      {tab === 'approved' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Tenant Approved" value={12} color="green" />
            <StatCard label="Active on Runs" value={9} />
            <StatCard label="Compliant" value={10} color="cyan" />
            <StatCard label="Expiring Soon" value={2} />
          </div>
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f4f2f1]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-primary uppercase tracking-wide">Driver</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-primary uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-primary uppercase tracking-wide">Approved Date</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-primary uppercase tracking-wide">Compliance</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-primary uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Marcus Johnson', client: 'Auckland DHB', date: 'Feb 28, 2026', compliance: 100, status: 'Active' },
                  { name: 'Sarah Chen', client: 'NZ Blood Service', date: 'Feb 25, 2026', compliance: 100, status: 'Active' },
                  { name: 'David Rawiri', client: 'Roche Diagnostics', date: 'Feb 20, 2026', compliance: 85, status: 'Active' },
                  { name: 'Emma Wilson', client: 'Auckland DHB', date: 'Feb 18, 2026', compliance: 100, status: 'Active' },
                  { name: 'Raj Patel', client: 'Fisher & Paykel', date: 'Feb 15, 2026', compliance: 70, status: 'Expiring' },
                  { name: 'Tanya Brooks', client: 'Medlab Central', date: 'Feb 10, 2026', compliance: 100, status: 'Active' },
                  { name: 'Chris Ngata', client: 'NZ Blood Service', date: 'Feb 8, 2026', compliance: 100, status: 'Active' },
                  { name: 'Lisa Fong', client: 'Auckland DHB', date: 'Feb 5, 2026', compliance: 100, status: 'Active' },
                  { name: 'Sam Te Pou', client: 'Roche Diagnostics', date: 'Jan 28, 2026', compliance: 60, status: 'Expiring' },
                  { name: 'Michelle Adams', client: 'Fisher & Paykel', date: 'Jan 25, 2026', compliance: 100, status: 'Active' },
                  { name: 'Tyler Harawira', client: 'Medlab Central', date: 'Jan 20, 2026', compliance: 100, status: 'Active' },
                  { name: 'Kate O\'Brien', client: 'Auckland DHB', date: 'Jan 15, 2026', compliance: 100, status: 'Active' },
                ].map((d, i) => (
                  <tr key={i} className="border-t border-border hover:bg-surface-cream cursor-pointer" onClick={() => navigate('/fleet')}>
                    <td className="px-4 py-2.5 font-medium">{d.name}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{d.client}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{d.date}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        d.compliance >= 90 ? 'bg-green-100 text-green-700' :
                        d.compliance >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>{d.compliance}%</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${d.status === 'Active' ? 'text-green-600' : 'text-amber-600'}`}>
                        {d.status === 'Active' ? '● Active' : '⚠ ' + d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
