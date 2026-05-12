import { useNavigate } from 'react-router-dom';
import { mockCourier, mockRuns, getMockUninvoiced, mockSchedules } from '@/services/portal_mockData';

export default function PortalDashboard() {
  const navigate = useNavigate();
  const uninvoiced = getMockUninvoiced(mockCourier.country);
  const upcomingRuns = mockRuns.filter(r => r.status !== 'Completed').length;
  const pendingSchedules = mockSchedules.filter(s => !s.response).length;

  return (
    <div className="space-y-4">
      {/* Welcome */}
      <div className="bg-brand-dark rounded-xl p-4 text-white">
        <p className="text-white/60 text-xs">Welcome back</p>
        <h1 className="text-lg font-bold">{mockCourier.firstName} {mockCourier.surname}</h1>
        <p className="text-brand-cyan text-xs mt-1">{mockCourier.code}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => navigate('/portal/runs')} className="bg-white rounded-xl p-4 border border-border text-left hover:border-brand-cyan transition-colors">
          <div className="text-2xl font-bold text-brand-dark">{upcomingRuns}</div>
          <div className="text-xs text-text-muted mt-1">Upcoming Runs</div>
        </button>
        <button onClick={() => navigate('/portal/invoicing')} className="bg-white rounded-xl p-4 border border-border text-left hover:border-brand-cyan transition-colors">
          <div className="text-2xl font-bold text-brand-dark">${uninvoiced.courier.total.toFixed(0)}</div>
          <div className="text-xs text-text-muted mt-1">Uninvoiced</div>
        </button>
        <button onClick={() => navigate('/portal/schedule')} className="bg-white rounded-xl p-4 border border-border text-left hover:border-brand-cyan transition-colors">
          <div className="text-2xl font-bold text-brand-dark">{pendingSchedules}</div>
          <div className="text-xs text-text-muted mt-1">Pending Schedules</div>
        </button>
        <button onClick={() => navigate('/portal/reports')} className="bg-white rounded-xl p-4 border border-border text-left hover:border-brand-cyan transition-colors">
          <div className="text-2xl font-bold text-brand-dark">156</div>
          <div className="text-xs text-text-muted mt-1">Total Runs</div>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-primary">Quick Actions</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { label: 'View Schedule', icon: '📅', to: '/portal/schedule' },
            { label: 'My Runs', icon: '🚚', to: '/portal/runs' },
            { label: 'Create Invoice', icon: '💰', to: '/portal/invoicing' },
          ].map(a => (
            <button
              key={a.to}
              onClick={() => navigate(a.to)}
              className="flex-shrink-0 bg-white border border-border rounded-lg px-4 py-3 flex items-center gap-2 text-sm hover:border-brand-cyan transition-colors"
            >
              <span>{a.icon}</span> {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-2">Recent Activity</h2>
        <div className="space-y-2">
          {mockRuns.slice(0, 3).map(run => (
            <button
              key={run.id}
              onClick={() => navigate('/portal/runs')}
              className="w-full bg-white rounded-lg border border-border p-3 flex items-center gap-3 text-left hover:border-brand-cyan transition-colors"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                run.status === 'In Progress' ? 'bg-brand-cyan' :
                run.status === 'Completed' ? 'bg-success' : 'bg-warning'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{run.name}</div>
                <div className="text-xs text-text-muted">{run.location} · {run.startTime}–{run.endTime}</div>
              </div>
              <div className="text-xs text-text-muted flex-shrink-0">{run.status}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
