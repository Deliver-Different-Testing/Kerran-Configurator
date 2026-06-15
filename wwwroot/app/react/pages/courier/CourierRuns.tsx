import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { courierRunsService, type CourierRun, type CourierRunsResult } from '@/services/courier_runsService';
import { extractCourierError } from '@/services/courier_api';

// Phase 2 — My Runs list. Current / Past tabs; click a run → detail.
export default function CourierRuns() {
  const [data, setData] = useState<CourierRunsResult | null>(null);
  const [tab, setTab] = useState<'current' | 'past'>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    courierRunsService.list()
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError(extractCourierError(e, 'Could not load your runs.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <Card>Loading…</Card>;
  if (error) return <Card><div className="text-sm text-red-700">⚠️ {error}</div></Card>;

  const runs = tab === 'current' ? data?.current ?? [] : data?.past ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Tab label={`Current (${data?.current.length ?? 0})`} active={tab === 'current'} onClick={() => setTab('current')} />
        <Tab label={`Past (${data?.past.length ?? 0})`} active={tab === 'past'} onClick={() => setTab('past')} />
      </div>

      {runs.length === 0 && <Card><div className="text-sm text-text-muted">No {tab} runs.</div></Card>}

      {runs.map(run => (
        <button
          key={`${run.bookDate}-${run.runName}`}
          onClick={() => navigate(`detail?bookDate=${encodeURIComponent(run.bookDate)}&runName=${encodeURIComponent(run.runName)}`)}
          className="w-full text-left rounded-lg bg-white border border-border shadow-sm p-4 hover:border-brand-cyan"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-text-primary">{run.dateDisplay} · {run.runName}</div>
            <div className="text-sm font-bold text-text-primary">${run.amount.toFixed(2)}</div>
          </div>
          <div className="text-xs text-text-muted mt-1">
            {run.jobs.length} stop{run.jobs.length === 1 ? '' : 's'}
            {run.cities ? ` · ${run.cities}` : ''}
            {run.kms ? ` · ${run.kms} km` : ''}
          </div>
        </button>
      ))}
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-semibold rounded-full ${active ? 'bg-brand-cyan text-brand-dark' : 'border border-border text-text-secondary'}`}
    >
      {label}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white border border-border shadow-sm p-5">{children}</div>;
}

export type { CourierRun };
