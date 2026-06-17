import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';

// Courier Portal (Phase 1) — themed login screen for anonymous visitors.
//
// Two ways in: the Hub shared-cookie SSO (existing), or a magic link
// (/drive/<slug>/<token>, Item 8.5) redeemed by CourierPortalSessionContext.
// This screen is the unauthed view — it shows the Hub sign-in button and, when
// a magic link failed to redeem, the reason.
export default function CourierLogin({ error }: { error?: string | null } = {}) {
  const theme = useCourierPortalTheme();

  return (
    <div className="w-full h-screen flex flex-col bg-[#fafbfc] overflow-hidden">
      <header className={`${theme.headerClass} py-4 px-6 flex-shrink-0`}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <img src={theme.logoSrc} alt={theme.brandName} className="w-8 h-8 object-contain" />
          <div>
            <div className="text-base font-bold text-white">{theme.brandName}</div>
            <div className="text-xs text-white/60 uppercase tracking-wider">Courier Portal</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto">
          <div className="rounded-lg bg-white border border-border shadow-sm p-8 text-center">
            {error && (
              <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 text-sm text-left">
                ⚠️ {error}
              </div>
            )}
            <h1 className="text-xl font-bold text-text-primary mb-2">Welcome back</h1>
            <p className="text-sm text-text-muted mb-6">
              Sign in to view your runs, schedule and documents.
            </p>

            <button
              onClick={() => { window.location.href = '/'; }}
              className={`w-full px-5 py-2.5 text-sm font-bold rounded-full ${theme.accentBtnClass}`}
            >
              Sign in with {theme.brandName}
            </button>

            <p className="text-xs text-text-muted mt-6">
              Are you new? You'll need an invite from your operator. SMS sign-in is coming soon.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
