import { useEffect, useState } from 'react';
import {
  courierProfileService,
  type CourierProfile,
  type CourierProfileUpdate,
} from '@/services/courier_profileService';
import { extractCourierError } from '@/services/courier_api';

// Phase 2 — courier self-service Settings/Profile. Renders inside
// CourierPortalShell (chrome + bottom nav provided by the shell). Full profile
// parity with the legacy portal: contact, address, licence/vehicle, banking,
// tax/GST. Password change is a later slice (depends on the courier mobile-login
// provisioning work — Master.User hash authority).

const s = (v: string | null | undefined) => v ?? '';

function Field({ label, value, onChange, type = 'text', readOnly = false }: {
  label: string; value: string; onChange?: (v: string) => void; type?: string; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-secondary uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        className={`rounded-md border border-border px-3 py-2 text-sm ${readOnly ? 'bg-surface-light text-text-muted' : ''}`}
      />
    </div>
  );
}

export default function CourierSettings() {
  const [profile, setProfile] = useState<CourierProfile | null>(null);
  const [draft, setDraft] = useState<CourierProfileUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    courierProfileService.get()
      .then(p => { if (alive) { setProfile(p); setDraft(toDraft(p)); } })
      .catch(e => { if (alive) setError(extractCourierError(e, 'Could not load your profile.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <Card>Loading…</Card>;
  if (error && !profile) return <Card><div className="text-sm text-red-700">⚠️ {error}</div></Card>;
  if (!profile || !draft) return null;

  const set = (k: keyof CourierProfileUpdate) => (v: string) => { setSaved(false); setDraft({ ...draft, [k]: v }); };

  async function save() {
    if (!draft) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const updated = await courierProfileService.update(draft);
      setProfile(updated);
      setDraft(toDraft(updated));
      setSaved(true);
    } catch (e) {
      setError(extractCourierError(e, 'Could not save your profile.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">My details</h1>
            <p className="text-sm text-text-muted">Keep your contact, vehicle and payment details up to date.</p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-surface-light text-text-secondary whitespace-nowrap">
            {profile.code}
          </span>
        </div>
      </Card>

      <Card>
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">⚠️ {error}</div>}
        {saved && <div className="mb-4 rounded-md bg-success-bg border border-success/30 px-4 py-3 text-sm text-success">✅ Saved.</div>}

        <div className="text-base font-bold text-text-primary mb-3">Contact</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="First name" value={s(draft.firstName)} onChange={set('firstName')} />
          <Field label="Surname" value={s(draft.surname)} onChange={set('surname')} />
          <Field label="Phone" value={s(draft.phone)} onChange={set('phone')} />
          <Field label="Mobile" value={s(draft.mobile)} onChange={set('mobile')} />
          <Field label="Email" type="email" value={s(draft.email)} onChange={set('email')} />
        </div>

        <div className="text-base font-bold text-text-primary mt-6 mb-3">Address</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Address line 1" value={s(draft.addressLine1)} onChange={set('addressLine1')} />
          <Field label="Address line 2" value={s(draft.addressLine2)} onChange={set('addressLine2')} />
          <Field label="Address line 3" value={s(draft.addressLine3)} onChange={set('addressLine3')} />
          <Field label="Address line 4" value={s(draft.addressLine4)} onChange={set('addressLine4')} />
          <Field label="Address line 5" value={s(draft.addressLine5)} onChange={set('addressLine5')} />
          <Field label="Address line 6" value={s(draft.addressLine6)} onChange={set('addressLine6')} />
          <Field label="Address line 7" value={s(draft.addressLine7)} onChange={set('addressLine7')} />
          <Field label="Address line 8" value={s(draft.addressLine8)} onChange={set('addressLine8')} />
        </div>

        <div className="text-base font-bold text-text-primary mt-6 mb-3">Licence &amp; vehicle</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Driver's licence no." value={s(draft.driversLicenceNo)} onChange={set('driversLicenceNo')} />
          <Field label="Vehicle registration no." value={s(draft.vehicleRegistrationNo)} onChange={set('vehicleRegistrationNo')} />
        </div>

        <div className="text-base font-bold text-text-primary mt-6 mb-3">Banking &amp; tax</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Bank routing / BSB" value={s(draft.bankRoutingNumber)} onChange={set('bankRoutingNumber')} />
          <Field label="Bank account no." value={s(draft.bankAccountNo)} onChange={set('bankAccountNo')} />
          <Field label="Tax / GST no." value={s(draft.taxNo)} onChange={set('taxNo')} />
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={save}
            disabled={busy}
            className="px-5 py-2 text-sm font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        <p className="text-xs text-text-muted mt-4">Password change is coming in an upcoming update.</p>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white border border-border shadow-sm p-5">{children}</div>;
}

function toDraft(p: CourierProfile): CourierProfileUpdate {
  const { id: _id, code: _code, courierTypeId: _t, isMaster: _m, ...rest } = p;
  return rest;
}
