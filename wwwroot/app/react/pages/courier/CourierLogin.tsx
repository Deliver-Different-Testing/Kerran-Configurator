import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';
import { courierPortalAuthService, courierPortalSession } from '@/services/courier_portalSession';

// Courier Portal login — themed sign-in for anonymous visitors. Three ways in:
//   • Hub shared-cookie SSO (button below).
//   • Magic link (/drive/<slug>/<token>) redeemed by CourierPortalSessionContext.
//   • Passwordless SMS 2FA (§17b) — enter mobile → 6-digit code → session.
export default function CourierLogin({ error }: { error?: string | null } = {}) {
  const theme = useCourierPortalTheme();
  const location = useLocation();
  const slug = location.pathname.split('/')[2] || 'portal';

  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);

  const errText = (e: unknown, fallback: string) => {
    const ax = e as { response?: { data?: { message?: string; retryAfterSeconds?: number } } };
    const d = ax.response?.data;
    if (!d?.message) return fallback;
    return d.retryAfterSeconds ? `${d.message} (try again in ~${d.retryAfterSeconds}s)` : d.message;
  };

  const sendCode = async () => {
    if (!mobile.trim()) return;
    setBusy(true); setSmsError(null); setNotice(null);
    try {
      await courierPortalAuthService.requestSmsCode(mobile.trim());
      setStep('code');
      setNotice('If that mobile is registered, we’ve sent a 6-digit code. It expires in 10 minutes.');
    } catch (e) {
      setSmsError(errText(e, 'Could not send a code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!code.trim()) return;
    setBusy(true); setSmsError(null);
    try {
      const r = await courierPortalAuthService.verifySmsCode(mobile.trim(), code.trim());
      courierPortalSession.adopt({
        token: r.token,
        expires: '',
        courier: { id: r.courierId, code: '', firstName: r.firstName, surName: '', email: '', phone: '' },
      });
      // Full load so CourierPortalSessionContext re-bootstraps from the stored token.
      window.location.assign(`/drive/${slug}/dashboard`);
    } catch (e) {
      setSmsError(errText(e, 'That code is invalid or has expired.'));
    } finally {
      setBusy(false);
    }
  };

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
          <div className="rounded-lg bg-white border border-border shadow-sm p-8">
            {error && (
              <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 text-sm">
                ⚠️ {error}
              </div>
            )}
            <h1 className="text-xl font-bold text-text-primary mb-2 text-center">Welcome back</h1>
            <p className="text-sm text-text-muted mb-6 text-center">
              Sign in to view your runs, schedule and documents.
            </p>

            {/* ── SMS sign-in ── */}
            {notice && (
              <div className="mb-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 px-3 py-2 text-xs">{notice}</div>
            )}
            {smsError && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">⚠️ {smsError}</div>
            )}

            {step === 'mobile' ? (
              <div className="space-y-2">
                <label className="text-xs text-text-secondary uppercase tracking-wide">Mobile number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendCode(); }}
                  placeholder="e.g. 021 234 5678"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                />
                <button
                  onClick={sendCode}
                  disabled={busy || !mobile.trim()}
                  className={`w-full px-5 py-2.5 text-sm font-bold rounded-full ${theme.accentBtnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {busy ? 'Sending…' : 'Text me a code'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-text-secondary uppercase tracking-wide">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') verify(); }}
                  placeholder="123456"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm tracking-[0.3em] text-center"
                />
                <button
                  onClick={verify}
                  disabled={busy || code.trim().length < 6}
                  className={`w-full px-5 py-2.5 text-sm font-bold rounded-full ${theme.accentBtnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {busy ? 'Verifying…' : 'Verify & sign in'}
                </button>
                <div className="flex items-center justify-between text-xs pt-1">
                  <button onClick={() => { setStep('mobile'); setCode(''); setSmsError(null); setNotice(null); }} className="text-text-muted hover:underline">
                    ← Change number
                  </button>
                  <button onClick={sendCode} disabled={busy} className="text-brand-cyan hover:underline disabled:opacity-50">
                    Resend code
                  </button>
                </div>
              </div>
            )}

            {/* ── divider + Hub SSO ── */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-text-muted uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full px-5 py-2.5 text-sm font-medium rounded-full border border-border text-text-primary hover:border-brand-cyan hover:text-brand-cyan transition-all"
            >
              Sign in with {theme.brandName}
            </button>

            <p className="text-xs text-text-muted mt-6 text-center">
              Are you new? You'll need an invite from your operator.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
