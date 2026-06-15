import { Outlet } from 'react-router-dom';
import { ApplicantAuthProvider } from '@/hooks/useApplicantAuth';
import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';

// Courier Portal (Phase 1) — themed chrome + applicant session provider for the
// /apply/:tenantSlug/* route tree. Mirrors the standalone QuoteResponse layout
// (full-screen flex column, dark header, scrollable centred main) so it works
// with index.css's body flex/overflow rules.
export default function ApplicantShell() {
  const theme = useCourierPortalTheme();
  return (
    <ApplicantAuthProvider>
      <div className="w-full h-screen flex flex-col bg-[#fafbfc] overflow-hidden">
        <header className={`${theme.headerClass} py-4 px-6 flex-shrink-0`}>
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <img src={theme.logoSrc} alt={theme.brandName} className="w-8 h-8 object-contain" />
            <div>
              <div className="text-base font-bold text-white">{theme.brandName}</div>
              <div className="text-xs text-white/60 uppercase tracking-wider">Courier Application</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </ApplicantAuthProvider>
  );
}
