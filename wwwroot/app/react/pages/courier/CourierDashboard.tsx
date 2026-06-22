import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCourierPortalSession } from '@/context/CourierPortalSessionContext';
import { courierDashboardService, type CourierDashboard } from '@/services/courier_dashboardService';

// Courier Portal (finish-line P0) — landing dashboard. Tiles are now backed by
// real per-courier stats (today's runs, next accepted shift, document health,
// this week's completed runs), derived server-side from runs/schedule/documents.

// Headline + hint for the Documents tile, in priority order (most actionable
// first), so the courier sees the one thing worth acting on at a glance.
function documentsTile(d: CourierDashboard): { value: string; hint: string } {
  if (d.documentsRejected > 0) return { value: String(d.documentsRejected), hint: 'Rejected — re-upload needed' };
  if (d.documentsMissingRequired > 0) return { value: String(d.documentsMissingRequired), hint: 'Required docs missing' };
  if (d.documentsExpiringSoon > 0) return { value: String(d.documentsExpiringSoon), hint: 'Expiring soon' };
  if (d.documentsPending > 0) return { value: String(d.documentsPending), hint: 'Under review' };
  return { value: '✓', hint: 'All up to date' };
}

export default function CourierDashboard() {
  const { user } = useAuth();
  const { courier } = useCourierPortalSession();
  // Magic-link couriers have no Hub user — greet them by the portal-session name.
  const firstName = courier?.firstName || user.fullName?.split(' ')[0] || 'there';

  const [data, setData] = useState<CourierDashboard | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    courierDashboardService.get()
      .then(d => { if (alive) setData(d); })
      .catch(() => { /* tiles fall back to em-dash; non-fatal on the landing page */ })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const docs = data ? documentsTile(data) : { value: '—', hint: 'Licences, insurance & compliance' };

  const tiles: { label: string; value: string; hint: string; to: string }[] = [
    { label: "Today's runs", value: data ? String(data.todaysRuns) : '—', hint: 'Your assigned runs', to: '../runs' },
    { label: 'Next shift', value: data?.nextShift ?? (loaded ? 'None booked' : '—'), hint: 'From your schedule', to: '../schedule' },
    { label: 'Documents', value: docs.value, hint: docs.hint, to: '../documents' },
    { label: 'This week', value: data ? String(data.weekCompletedRuns) : '—', hint: 'Completed runs', to: '../runs' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white border border-border shadow-sm p-5">
        <h1 className="text-xl font-bold text-text-primary">Hi {firstName} 👋</h1>
        <p className="text-sm text-text-muted">Here's your day at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map(t => (
          <Link
            key={t.label}
            to={t.to}
            className="rounded-lg bg-white border border-border shadow-sm p-4 hover:border-brand-cyan"
          >
            <div className="text-xs text-text-muted uppercase tracking-wide">{t.label}</div>
            <div className="text-2xl font-bold text-text-primary mt-1">{t.value}</div>
            <div className="text-xs text-text-muted mt-1">{t.hint}</div>
          </Link>
        ))}
      </div>

      <Link
        to="../contractors"
        className="block rounded-lg bg-white border border-border shadow-sm p-4 hover:border-brand-cyan"
      >
        <div className="text-sm font-bold text-text-primary">Subcontractors →</div>
        <div className="text-xs text-text-muted mt-0.5">Manage your drivers' payment splits (master couriers).</div>
      </Link>

      <div className="rounded-lg bg-surface-light border border-border p-4 text-sm text-text-secondary">
        This is the new courier portal. Runs, schedule, documents and profile are being rolled out —
        the legacy portal stays available during the transition.
      </div>
    </div>
  );
}
