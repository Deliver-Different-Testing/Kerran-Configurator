import { Routes, Route, Navigate } from 'react-router-dom';
import { CourierPortalSessionProvider, useCourierPortalSession } from '@/context/CourierPortalSessionContext';
import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';
import CourierPortalShell, { CourierComingSoon } from './CourierPortalShell';
import CourierLogin from './CourierLogin';
import CourierDashboard from './CourierDashboard';
import CourierRuns from './CourierRuns';
import CourierRunDetail from './CourierRunDetail';
import CourierSchedule from './CourierSchedule';
import CourierContractors from './CourierContractors';
import CourierSettings from './CourierSettings';

// Courier Portal magic-link (Item 8.5) — entry for /drive/*. Wraps the subtree
// in the session provider so a magic-link courier (passwordless) and a Hub-SSO
// courier both resolve to the same shell. `hubAuthed` is the derived-role gate
// for SSO couriers; portal couriers are authed by a redeemed/stored token.
export default function CourierPortalRouter({ hubAuthed }: { hubAuthed: boolean }) {
  return (
    <CourierPortalSessionProvider hubAuthed={hubAuthed}>
      <DriveGate />
    </CourierPortalSessionProvider>
  );
}

function DriveGate() {
  const { loading, authed, error } = useCourierPortalSession();

  if (loading) return <PortalSpinner />;

  if (!authed) {
    return (
      <Routes>
        <Route path="/drive/:tenantSlug/*" element={<CourierLogin error={error} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/drive/:tenantSlug/login" element={<Navigate to=".." replace />} />
      <Route path="/drive/:tenantSlug" element={<CourierPortalShell />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CourierDashboard />} />
        <Route path="runs" element={<CourierRuns />} />
        <Route path="runs/detail" element={<CourierRunDetail />} />
        <Route path="schedule" element={<CourierSchedule />} />
        <Route path="documents" element={<CourierComingSoon title="Documents" />} />
        <Route path="contractors" element={<CourierContractors />} />
        <Route path="profile" element={<CourierSettings />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function PortalSpinner() {
  const theme = useCourierPortalTheme();
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-3 bg-[#fafbfc]">
      <div className="w-8 h-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin" />
      <div className="text-sm text-text-muted">Signing you in to {theme.brandName}…</div>
    </div>
  );
}
