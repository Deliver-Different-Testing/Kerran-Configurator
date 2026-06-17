import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCourierPortalSession } from '@/context/CourierPortalSessionContext';
import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';

// Courier Portal — themed shell (top brand header + bottom nav) for
// authenticated couriers. Runs / Schedule / Profile + Subcontractors are live;
// Dashboard is a stub and Documents is still a placeholder. Mobile-first: the
// bottom nav is the primary way couriers reach the business pages.

const NAV: { to: string; label: string; icon: string }[] = [
  { to: 'dashboard', label: 'Home', icon: '🏠' },
  { to: 'runs', label: 'Runs', icon: '📦' },
  { to: 'schedule', label: 'Schedule', icon: '📅' },
  { to: 'documents', label: 'Docs', icon: '📄' },
  { to: 'profile', label: 'Profile', icon: '👤' },
];

export default function CourierPortalShell() {
  const theme = useCourierPortalTheme();
  const { user } = useAuth();
  const { courier } = useCourierPortalSession();
  // Magic-link couriers have no Hub user — show the portal-session name instead.
  const displayName = courier ? `${courier.firstName} ${courier.surName}`.trim() : user.fullName;

  return (
    // min-h-[100dvh] + a FIXED bottom nav. The nav must be pinned to the viewport
    // bottom rather than be the last child of a fixed-height flex column: on
    // mobile that approach put the nav below the visible viewport (the 100vh /
    // address-bar trap) so couriers — who are phone-first — saw no nav at all.
    // Fixed positioning is immune to viewport-unit support, utility ordering, and
    // any host-page height/offset quirks. main gets bottom padding to clear it.
    <div className="w-full min-h-[100dvh] flex flex-col bg-[#fafbfc]">
      <header className={`${theme.headerClass} py-3 px-5 sticky top-0 z-30`}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={theme.logoSrc} alt={theme.brandName} className="w-7 h-7 object-contain" />
            <div>
              <div className="text-sm font-bold text-white">{theme.brandName}</div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider">Courier Portal</div>
            </div>
          </div>
          {displayName && <div className="text-xs text-white/80">{displayName}</div>}
        </div>
      </header>

      <main className="flex-1 p-5 pb-24">
        <div className="max-w-3xl mx-auto">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white shadow-[0_-1px_6px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  isActive ? 'text-brand-cyan font-semibold' : 'text-text-muted'
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Placeholder for nav destinations not yet built (Runs / Schedule / Documents /
// Profile). Phase 3+ replaces these with the real surfaces.
export function CourierComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-lg bg-white border border-border shadow-sm p-8 text-center">
      <div className="text-base font-bold text-text-primary mb-1">{title}</div>
      <div className="text-sm text-text-muted">This section is coming in an upcoming update.</div>
    </div>
  );
}
