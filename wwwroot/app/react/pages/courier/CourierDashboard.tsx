import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCourierPortalSession } from '@/context/CourierPortalSessionContext';

// Courier Portal (Phase 1) — dashboard stub. Renders inside CourierPortalShell.
// Real data (today's runs, schedule, earnings, documents) lands in Phase 3+;
// for now these are static placeholder tiles so the shell is navigable and the
// branded surface is verifiable end-to-end.

const TILES: { label: string; value: string; hint: string }[] = [
  { label: "Today's runs", value: '—', hint: 'Your assigned runs will appear here' },
  { label: 'Next shift', value: '—', hint: 'From your schedule' },
  { label: 'Documents', value: '—', hint: 'Licences, insurance & compliance' },
  { label: 'This week', value: '—', hint: 'Completed jobs' },
];

export default function CourierDashboard() {
  const { user } = useAuth();
  const { courier } = useCourierPortalSession();
  // Magic-link couriers have no Hub user — greet them by the portal-session name.
  const firstName = courier?.firstName || user.fullName?.split(' ')[0] || 'there';

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white border border-border shadow-sm p-5">
        <h1 className="text-xl font-bold text-text-primary">Hi {firstName} 👋</h1>
        <p className="text-sm text-text-muted">Here's your day at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TILES.map(t => (
          <div key={t.label} className="rounded-lg bg-white border border-border shadow-sm p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide">{t.label}</div>
            <div className="text-2xl font-bold text-text-primary mt-1">{t.value}</div>
            <div className="text-xs text-text-muted mt-1">{t.hint}</div>
          </div>
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
