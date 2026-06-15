import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useApplicantAuth } from '@/hooks/useApplicantAuth';
import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';
import { extractPortalError } from '@/services/applicant_api';
import { Card, ErrorBanner, Field, PrimaryButton } from './ui';

// Phase 1 inline email verification. The email is carried over from registration
// via the ?email= query (also editable). A correct code logs the applicant in
// immediately (issues the signed session token) and drops them into the wizard.
export default function ApplicantVerify() {
  const { verify, isAuthenticated } = useApplicantAuth();
  const theme = useCourierPortalTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) return <Navigate to={`/apply/${theme.slug}/apply`} replace />;

  async function submit() {
    setBusy(true); setError(null);
    try {
      await verify(email.trim(), code.trim());
      navigate(`/apply/${theme.slug}/apply`);
    } catch (e) {
      setError(extractPortalError(e, 'Could not verify that code.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-bold text-text-primary mb-1">Verify your email</h1>
      <p className="text-sm text-text-muted mb-5">
        We emailed a 6-digit code to <span className="font-semibold text-text-secondary">{email || 'your address'}</span>.
        Enter it below to continue your application.
      </p>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-3">
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Verification code" value={code} onChange={setCode} required autoFocus placeholder="6-digit code" />
      </div>

      <div className="flex items-center justify-between mt-5">
        <button
          type="button"
          onClick={() => navigate(`/apply/${theme.slug}`)}
          className="text-sm text-text-muted hover:underline"
        >
          ← Back
        </button>
        <PrimaryButton onClick={submit} disabled={busy || !code} className={theme.accentBtnClass}>
          {busy ? 'Verifying…' : 'Verify & continue'}
        </PrimaryButton>
      </div>
    </Card>
  );
}
