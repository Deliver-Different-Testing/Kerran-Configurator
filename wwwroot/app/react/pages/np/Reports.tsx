import { useEffect, useState } from 'react';
import StatCard from '@/components/common/StatCard';
import BarChart from '@/components/common/BarChart';
import { reportService, ReportData } from '@/services/np_reportService';

const EMPTY: ReportData = {
  jobsCompleted: 0,
  onTimePercent: 0,
  revenue: '$0',
  dailyVolume: [],
};

export default function Reports() {
  const [from, setFrom] = useState('2026-02-22');
  const [to, setTo] = useState('2026-02-28');
  const [data, setData] = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(false);

  // Fetch on mount and whenever the user clicks Generate Report.
  // (Keeping the fetch off date-onChange so users can finish typing both dates.)
  const refresh = (f: string, t: string) => {
    let alive = true;
    setLoading(true);
    reportService.getData(f, t)
      .then(d => { if (alive) setData(d); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  };

  useEffect(() => {
    return refresh(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h2 className="text-xl font-bold mb-5">Reports</h2>

      <div className="flex gap-3 mb-6 flex-wrap items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
        </div>
        <button
          onClick={() => refresh(from, to)}
          disabled={loading}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Generate Report'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Jobs Completed" value={data.jobsCompleted} color="green" />
        <StatCard label="On-Time %" value={`${data.onTimePercent}%`} color="cyan" />
        <StatCard label="Your Revenue" value={data.revenue} note="Rate-masked — customer pricing hidden" />
      </div>

      <div className="bg-white border border-border rounded-lg p-5">
        <h3 className="font-bold mb-4">Daily Job Volume</h3>
        <BarChart data={data.dailyVolume.map(d => ({ label: d.day, value: d.value }))} />
      </div>
    </>
  );
}
