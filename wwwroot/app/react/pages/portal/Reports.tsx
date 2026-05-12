import { mockReportSummary } from '@/services/portal_mockData';

export default function PortalReports() {
  const r = mockReportSummary;
  const maxEarnings = Math.max(...r.weeklyData.map(w => w.earnings));

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-brand-dark">{r.totalRuns}</div>
          <div className="text-xs text-text-muted">Total Runs</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-brand-dark">${r.totalEarnings.toLocaleString()}</div>
          <div className="text-xs text-text-muted">Total Earnings</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-brand-dark">{r.thisWeekRuns}</div>
          <div className="text-xs text-text-muted">This Week</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-brand-dark">${r.thisWeekEarnings.toLocaleString()}</div>
          <div className="text-xs text-text-muted">Week Earnings</div>
        </div>
      </div>

      {/* This Month */}
      <div className="bg-brand-dark rounded-xl p-4 text-white">
        <div className="text-xs text-white/60">This Month</div>
        <div className="flex items-baseline gap-4 mt-1">
          <div><span className="text-2xl font-bold">{r.thisMonthRuns}</span> <span className="text-xs text-white/60">runs</span></div>
          <div><span className="text-2xl font-bold">${r.thisMonthEarnings.toLocaleString()}</span> <span className="text-xs text-white/60">earned</span></div>
        </div>
        <div className="text-xs text-white/40 mt-1">Avg ${r.avgPerRun}/run</div>
      </div>

      {/* Weekly Bar Chart */}
      <div className="bg-white rounded-xl border border-border p-4">
        <h3 className="font-semibold text-sm mb-3">Weekly Earnings</h3>
        <div className="flex items-end gap-2 h-32">
          {r.weeklyData.map(w => (
            <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] text-text-muted font-medium">${w.earnings}</div>
              <div
                className="w-full bg-brand-cyan rounded-t"
                style={{ height: `${(w.earnings / maxEarnings) * 100}%`, minHeight: 4 }}
              />
              <div className="text-[10px] text-text-muted">{w.week.split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
