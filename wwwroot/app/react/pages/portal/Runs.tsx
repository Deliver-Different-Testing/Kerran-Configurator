import { useState } from 'react';
import { mockRuns, type Run, type Job } from '@/services/portal_mockData';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  'Upcoming': 'bg-warning text-white',
  'In Progress': 'bg-brand-cyan text-white',
  'Completed': 'bg-success text-white',
};

const JOB_STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-warning/20 text-warning',
  'In Transit': 'bg-brand-cyan/20 text-brand-cyan',
  'Delivered': 'bg-success/20 text-success',
  'Failed': 'bg-error/20 text-error',
};

export default function PortalRuns() {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  const filtered = mockRuns.filter(r => {
    if (filter === 'upcoming') return r.status !== 'Completed';
    if (filter === 'completed') return r.status === 'Completed';
    return true;
  });

  if (selectedRun) return <RunDetail run={selectedRun} onBack={() => setSelectedRun(null)} />;

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'upcoming', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? 'bg-brand-cyan text-white' : 'bg-white border border-border text-text-muted'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Run List */}
      {filtered.length === 0 && (
        <div className="text-center py-12 text-text-muted text-sm">No runs found</div>
      )}

      <div className="space-y-2">
        {filtered.map(run => (
          <button
            key={run.id}
            onClick={() => setSelectedRun(run)}
            className="w-full bg-white rounded-xl border border-border p-4 text-left hover:border-brand-cyan transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{run.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[run.status]}`}>
                    {run.status}
                  </span>
                </div>
                <div className="text-xs text-text-muted">{run.location}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {formatDate(run.bookDate)} · {run.startTime}–{run.endTime}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-brand-dark">{run.jobs.length}</div>
                <div className="text-[10px] text-text-muted">Jobs</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RunDetail({ run, onBack }: { run: Run; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-brand-cyan">
        ← Back to runs
      </button>

      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-lg">{run.name}</h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[run.status]}`}>
            {run.status}
          </span>
        </div>
        <div className="text-sm text-text-muted">{run.location}</div>
        <div className="text-sm text-text-muted">{formatDate(run.bookDate)} · {run.startTime}–{run.endTime}</div>
      </div>

      {/* Map Placeholder */}
      <div className="bg-white rounded-xl border border-border h-40 flex items-center justify-center text-text-muted text-sm">
        🗺️ Map placeholder — will show route
      </div>

      {/* Jobs */}
      <h3 className="font-semibold text-sm">Jobs ({run.jobs.length})</h3>
      <div className="space-y-2">
        {run.jobs.map(job => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 text-left">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${JOB_STATUS_COLORS[job.status]}`}>
            {job.status}
          </span>
          <span className="text-xs text-text-muted truncate flex-1">#{job.id}</span>
          <span className="text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          <div>
            <div className="text-[10px] text-text-muted uppercase">Pickup</div>
            <div className="text-xs">{job.pickupAddress}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase">Delivery</div>
            <div className="text-xs">{job.deliveryAddress}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted uppercase">POD:</span>
            {job.podSigned ? (
              <span className="text-xs text-success">✓ Signed{job.podSignedAt && ` (${new Date(job.podSignedAt).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })})`}</span>
            ) : (
              <span className="text-xs text-text-muted">Not signed</span>
            )}
          </div>
          {job.notes && <div className="text-xs text-error">⚠️ {job.notes}</div>}
        </div>
      )}
    </div>
  );
}
