import { useState } from 'react';
import { useApplicantAuth } from '@/hooks/useApplicantAuth';
import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';
import { extractPortalError } from '@/services/applicant_api';
import { DECLARATION_STATEMENT } from '@/services/portal_applicantService';
import { Card, ErrorBanner, Field, PrimaryButton, SuccessBanner } from './ui';

// Courier Portal (finish-line P1) — applicant end-of-funnel: declaration + final
// submit. Submitting stamps the declaration and advances the applicant into the
// staff recruitment pipeline (Documentation -> Training) for review. Shown at the
// bottom of the wizard, after the details form + document uploads.

export default function ApplicantSubmit() {
  const { applicant, submit } = useApplicantAuth();
  const theme = useCourierPortalTheme();
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!applicant) return null;

  // Already submitted — confirmation only, no form.
  if (applicant.submitted) {
    const when = applicant.submittedDate ? new Date(applicant.submittedDate).toLocaleDateString() : null;
    return (
      <Card>
        <SuccessBanner>
          ✅ Your application has been submitted{when ? ` on ${when}` : ''}.
        </SuccessBanner>
        <p className="text-sm text-text-muted">
          Thanks{applicant.declarationName ? `, ${applicant.declarationName}` : ''} — our team will review your
          details and documents and be in touch. You can still sign back in any time to check your status or
          re-upload a document if we ask you to.
        </p>
      </Card>
    );
  }

  async function onSubmit() {
    setBusy(true); setError(null);
    try {
      await submit(name.trim());
    } catch (e) {
      setError(extractPortalError(e, 'Could not submit your application. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = agree && name.trim().length > 0 && !busy;

  return (
    <Card>
      <h2 className="text-base font-bold text-text-primary mb-1">Declaration &amp; submit</h2>
      <p className="text-sm text-text-muted mb-4">
        Please make sure your details above are complete and your required documents are uploaded, then submit
        your application for review.
      </p>

      {error && <ErrorBanner message={error} />}

      <div className="rounded-md bg-surface-light border border-border p-3 text-sm text-text-secondary mb-4">
        {DECLARATION_STATEMENT}
      </div>

      <label className="flex items-start gap-2 text-sm text-text-primary mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={agree}
          onChange={e => setAgree(e.target.checked)}
          className="mt-0.5"
        />
        <span>I have read and agree to the declaration above.</span>
      </label>

      <div className="max-w-sm mb-5">
        <Field
          label="Full name (your signature)"
          value={name}
          onChange={setName}
          placeholder="Type your full name"
          required
        />
      </div>

      <div className="flex justify-end">
        <PrimaryButton onClick={onSubmit} disabled={!canSubmit} className={theme.accentBtnClass}>
          {busy ? 'Submitting…' : 'Submit application'}
        </PrimaryButton>
      </div>
    </Card>
  );
}
