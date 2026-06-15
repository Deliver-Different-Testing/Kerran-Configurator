import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApplicantAuth } from '@/hooks/useApplicantAuth';
import { useCourierPortalTheme } from '@/hooks/useCourierPortalTheme';
import { extractPortalError } from '@/services/applicant_api';
import type { ProgressPayload } from '@/services/portal_applicantService';
import { Card, ErrorBanner, Field, PrimaryButton, SuccessBanner } from './ui';

// Phase 1 authenticated application — the applicant fills in / resumes their
// details. Progress is saved server-side (PUT /api/portal/applicants), so a
// refresh or a return on another device resumes where they left off. Document
// upload + AI vetting + final submit/declaration are later phases (Phase 4).

type Draft = {
  addressLine1: string; city: string; state: string; postCode: string;
  driversLicenceNo: string; vehicleType: string; vehicleMake: string; vehicleModel: string;
  vehicleYear: string; vehicleRegistrationNo: string;
  bankAccountName: string; bankAccountNo: string; bankBsb: string;
  nextOfKin: string; nextOfKinRelationship: string; nextOfKinPhone: string; notes: string;
};

const s = (v: string | null | undefined) => v ?? '';

export default function ApplicantWizard() {
  const { applicant, loading, saveProgress } = useApplicantAuth();
  const theme = useCourierPortalTheme();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (loading) return <Card>Loading…</Card>;
  if (!applicant) return <Navigate to={`/apply/${theme.slug}`} replace />;

  // Lazily seed the draft from the loaded applicant (first render after auth).
  const d: Draft = draft ?? {
    addressLine1: s(applicant.addressLine1), city: s(applicant.city), state: s(applicant.state), postCode: s(applicant.postCode),
    driversLicenceNo: s(applicant.driversLicenceNo), vehicleType: s(applicant.vehicleType),
    vehicleMake: s(applicant.vehicleMake), vehicleModel: s(applicant.vehicleModel),
    vehicleYear: applicant.vehicleYear?.toString() ?? '', vehicleRegistrationNo: s(applicant.vehicleRegistrationNo),
    bankAccountName: s(applicant.bankAccountName), bankAccountNo: s(applicant.bankAccountNo), bankBsb: s(applicant.bankBsb),
    nextOfKin: s(applicant.nextOfKin), nextOfKinRelationship: s(applicant.nextOfKinRelationship),
    nextOfKinPhone: s(applicant.nextOfKinPhone), notes: s(applicant.notes),
  };

  const set = (k: keyof Draft) => (v: string) => { setSaved(false); setDraft({ ...d, [k]: v }); };

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    try {
      const payload: ProgressPayload = {
        ...d,
        vehicleYear: d.vehicleYear === '' ? null : Number(d.vehicleYear),
      };
      await saveProgress(payload);
      setSaved(true);
    } catch (e) {
      setError(extractPortalError(e, 'Could not save your progress.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              Welcome, {applicant.firstName}
            </h1>
            <p className="text-sm text-text-muted">Your details are saved as you go — you can return any time to finish.</p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-surface-light text-text-secondary whitespace-nowrap">
            {applicant.pipelineStage}
          </span>
        </div>
      </Card>

      <Card>
        {error && <ErrorBanner message={error} />}
        {saved && <SuccessBanner>✅ Progress saved.</SuccessBanner>}

        <div className="text-base font-bold text-text-primary mb-3">Address</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Address" value={d.addressLine1} onChange={set('addressLine1')} />
          <Field label="City" value={d.city} onChange={set('city')} />
          <Field label="State" value={d.state} onChange={set('state')} />
          <Field label="Post code" value={d.postCode} onChange={set('postCode')} />
        </div>

        <div className="text-base font-bold text-text-primary mt-6 mb-3">Vehicle &amp; licence</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Driver's licence no." value={d.driversLicenceNo} onChange={set('driversLicenceNo')} />
          <Field label="Vehicle type" value={d.vehicleType} onChange={set('vehicleType')} />
          <Field label="Make" value={d.vehicleMake} onChange={set('vehicleMake')} />
          <Field label="Model" value={d.vehicleModel} onChange={set('vehicleModel')} />
          <Field label="Year" type="number" value={d.vehicleYear} onChange={set('vehicleYear')} />
          <Field label="Registration no." value={d.vehicleRegistrationNo} onChange={set('vehicleRegistrationNo')} />
        </div>

        <div className="text-base font-bold text-text-primary mt-6 mb-3">Bank details</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Account name" value={d.bankAccountName} onChange={set('bankAccountName')} />
          <Field label="Account number" value={d.bankAccountNo} onChange={set('bankAccountNo')} />
          <Field label="BSB / routing" value={d.bankBsb} onChange={set('bankBsb')} />
        </div>

        <div className="text-base font-bold text-text-primary mt-6 mb-3">Next of kin</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name" value={d.nextOfKin} onChange={set('nextOfKin')} />
          <Field label="Relationship" value={d.nextOfKinRelationship} onChange={set('nextOfKinRelationship')} />
          <Field label="Phone" value={d.nextOfKinPhone} onChange={set('nextOfKinPhone')} />
        </div>

        <div className="text-base font-bold text-text-primary mt-6 mb-3">Notes</div>
        <textarea
          value={d.notes}
          onChange={e => set('notes')(e.target.value)}
          rows={3}
          placeholder="Anything else you'd like us to know?"
          className="w-full rounded-md border border-border px-3 py-2 text-sm resize-none"
        />

        <div className="flex justify-end mt-5">
          <PrimaryButton onClick={save} disabled={busy} className={theme.accentBtnClass}>
            {busy ? 'Saving…' : 'Save progress'}
          </PrimaryButton>
        </div>

        <p className="text-xs text-text-muted mt-4">
          Document upload &amp; final submission will be available in an upcoming update.
        </p>
      </Card>
    </div>
  );
}
