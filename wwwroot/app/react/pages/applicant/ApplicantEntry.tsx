import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApplicantAuth } from '@/hooks/useApplicantAuth';
import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';
import { extractPortalError } from '@/services/applicant_api';
import { Card, ErrorBanner, Field, PrimaryButton } from './ui';

// Phase 1 applicant entry — register a new application, or sign back in to
// resume. Register -> verify (email code) -> authenticated wizard. Sign-in is
// for returning applicants on a new device (their token isn't in localStorage).

type Mode = 'register' | 'signin';

export default function ApplicantEntry() {
  const { register, login, isAuthenticated, loading } = useApplicantAuth();
  const theme = useCourierPortalTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('register');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', mobile: '', password: '', vehicleType: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Card>Loading…</Card>;
  if (isAuthenticated) return <Navigate to={`/apply/${theme.slug}/apply`} replace />;

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submitRegister() {
    setBusy(true); setError(null);
    try {
      const { email } = await register(form);
      navigate(`/apply/${theme.slug}/verify?email=${encodeURIComponent(email)}`);
    } catch (e) {
      setError(extractPortalError(e, 'Could not start your application.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitSignin() {
    setBusy(true); setError(null);
    try {
      await login(form.email, form.password);
      navigate(`/apply/${theme.slug}/apply`);
    } catch (e) {
      setError(extractPortalError(e, 'Could not sign in.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-bold text-text-primary mb-1">
        {mode === 'register' ? 'Start your courier application' : 'Resume your application'}
      </h1>
      <p className="text-sm text-text-muted mb-5">
        {mode === 'register'
          ? 'Create an account to apply. We’ll email you a code to verify your address.'
          : 'Sign in with the email and password you registered with.'}
      </p>

      {error && <ErrorBanner message={error} />}

      {mode === 'register' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="First name" value={form.firstName} onChange={set('firstName')} required autoFocus />
          <Field label="Last name" value={form.lastName} onChange={set('lastName')} required />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Field label="Mobile" value={form.mobile} onChange={set('mobile')} required />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} required placeholder="At least 6 characters" />
          <Field label="Vehicle type" value={form.vehicleType} onChange={set('vehicleType')} placeholder="e.g. Van, Car, Motorbike" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <Field label="Email" type="email" value={form.email} onChange={set('email')} required autoFocus />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} required />
        </div>
      )}

      <div className="flex items-center justify-between mt-5">
        <button
          type="button"
          onClick={() => { setMode(m => (m === 'register' ? 'signin' : 'register')); setError(null); }}
          className="text-sm text-brand-cyan hover:underline"
        >
          {mode === 'register' ? 'Already started? Sign in' : 'New here? Create an application'}
        </button>
        <PrimaryButton
          onClick={mode === 'register' ? submitRegister : submitSignin}
          disabled={busy}
          className={theme.accentBtnClass}
        >
          {busy ? 'Please wait…' : mode === 'register' ? 'Create application' : 'Sign in'}
        </PrimaryButton>
      </div>
    </Card>
  );
}
