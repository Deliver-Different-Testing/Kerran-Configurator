import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { courierService } from '@/services/np_courierService';
import { lookupService, LookupItem } from '@/services/np_lookupService';
import FormField from '@/components/common/FormField';
import PasswordInput from '@/components/common/PasswordInput';
import DocumentUpload from '@/components/common/DocumentUpload';
import { useDocumentTypes, useCourierDocuments, useComplianceSummary } from '@/hooks/useDocuments';
import type { Courier, DocumentStatus } from '@/types';

const tabKeys = ['profile', 'vehicle', 'licensing', 'insurance', 'financial', 'device', 'documents', 'notes'] as const;
const tabLabels = ['Profile', 'Vehicle', 'Licensing', 'Insurance', 'Financial', 'Device & Settings', 'Documents', 'Notes & Audit'];

interface Props {
  onSelectCourier: (id: number) => void;
}

function isExpiringSoon(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date('2026-02-28');
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 30;
}

function isExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date('2026-02-28');
}

export default function CourierSetup({ onSelectCourier }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as typeof tabKeys[number]) || 'profile';
  const [tab, setTab] = useState<typeof tabKeys[number]>(tabKeys.includes(initialTab as any) ? initialTab : 'profile');
  const [courier, setCourier] = useState<Courier | undefined>();   // last-saved baseline
  const [draft, setDraft] = useState<Courier | undefined>();       // local edits
  const [masters, setMasters] = useState<Courier[]>([]);
  const [masterName, setMasterName] = useState<Courier | null>(null);
  const [vehicleMakes, setVehicleMakes] = useState<LookupItem[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<LookupItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Mobile App Login (set/reset password) — independent of the main Save.
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    let alive = true;
    if (id) {
      courierService.getById(Number(id)).then(c => {
        if (!alive) return;
        setCourier(c);
        setDraft(c);
        if (c) onSelectCourier(c.id);
      });
    }
    return () => { alive = false; };
  }, [id, onSelectCourier]);

  useEffect(() => {
    let alive = true;
    courierService.getMasters().then(m => { if (alive) setMasters(m); });
    lookupService.getVehicleMakes().then(v => { if (alive) setVehicleMakes(v); });
    lookupService.getInsuranceCompanies().then(i => { if (alive) setInsuranceCompanies(i); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (courier?.master) {
      courierService.getById(courier.master).then(m => { if (alive) setMasterName(m ?? null); });
    } else {
      setMasterName(null);
    }
    return () => { alive = false; };
  }, [courier?.master]);

  if (!courier || !draft) {
    return (
      <div className="bg-blue-50 border border-blue-200 text-blue-600 rounded-lg px-4 py-3.5 text-sm flex items-center gap-2.5">
        Select a courier from Fleet Overview to view their setup.
      </div>
    );
  }

  // Bind helpers — every editable FormField uses one of these to read from
  // draft and write back via setDraft. String/number/bool variants because
  // FormField's onChange surfaces different types per input kind.
  const bind = <K extends keyof Courier>(field: K) => ({
    value: (draft[field] ?? '') as string,
    onChange: (val: string | boolean) => setDraft(d => d ? { ...d, [field]: val as Courier[K] } : d),
  });
  const bindNum = <K extends keyof Courier>(field: K) => ({
    value: String(draft[field] ?? ''),
    onChange: (val: string | boolean) => setDraft(d => {
      if (!d) return d;
      const n = typeof val === 'string' ? (val.trim() === '' ? 0 : Number(val)) : 0;
      return { ...d, [field]: (Number.isFinite(n) ? n : 0) as Courier[K] };
    }),
  });
  const bindBool = <K extends keyof Courier>(field: K) => ({
    checked: !!draft[field],
    onChange: (val: string | boolean) => setDraft(d => d ? { ...d, [field]: (typeof val === 'boolean' ? val : !!val) as Courier[K] } : d),
  });

  const c = draft;
  const dirty = JSON.stringify(courier) !== JSON.stringify(draft);

  // Render a lookup-backed <select> wired to a Courier id/name pair. Storing
  // both fields means the displayed name stays correct without a re-fetch on
  // every dropdown change.
  function lookupSelect(
    label: string,
    idField: keyof Courier,
    nameField: keyof Courier,
    options: LookupItem[],
  ) {
    const currentId = (draft[idField] as number | null | undefined) ?? '';
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary uppercase tracking-wide">{label}</label>
        <select
          value={currentId}
          onChange={(e) => {
            const raw = e.target.value;
            const id = raw === '' ? null : Number(raw);
            const name = options.find(o => o.id === id)?.name ?? '';
            setDraft(d => d ? { ...d, [idField]: id, [nameField]: name } as Courier : d);
          }}
        >
          <option value="">— Select —</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
    );
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await courierService.update(draft.id, draft);
      setCourier(updated);
      setDraft(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save courier';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(courier);
    setSaveError(null);
    setSaveSuccess(false);
  }

  async function handleResetLogin() {
    if (!draft) return;
    setLoginError(null);
    setLoginSuccess(false);
    setLoginSaving(true);
    try {
      const updated = await courierService.resetLogin(draft.id, loginPassword);
      // Provisioning web-enables the courier — reflect that in both the saved
      // baseline and the draft so the Web Enabled checkbox stays accurate
      // without clobbering the operator's other unsaved edits.
      setCourier(updated);
      setDraft(d => (d ? { ...d, webEnabled: updated.webEnabled } : d));
      setLoginPassword('');
      setLoginSuccess(true);
      setTimeout(() => setLoginSuccess(false), 4000);
    } catch (e) {
      const ax = e as { response?: { data?: { messages?: { message?: string }[] } } };
      setLoginError(ax.response?.data?.messages?.[0]?.message ?? 'Could not set the mobile-app password. Please try again.');
    } finally {
      setLoginSaving(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-brand-cyan flex items-center justify-center text-xl font-bold text-white">
          {c.firstName[0]}{c.surName[0]}
        </div>
        <div>
          <h2 className="text-lg font-bold">{c.firstName} {c.surName}</h2>
          <div className="text-[13px] text-text-secondary">{c.code} · {c.type} Courier · {c.location}</div>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-xl text-xs border ${
          c.status === 'active'
            ? 'bg-green-50 text-success border-green-200'
            : 'bg-red-50 text-error border-[#991b1b]'
        }`}>
          ● {c.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-5 overflow-x-auto">
        {tabKeys.map((t, i) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] cursor-pointer whitespace-nowrap border-b-2 transition-all ${
              tab === t ? 'text-brand-cyan border-brand-cyan' : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            {tabLabels[i]}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-border rounded-lg p-5">
        {tab === 'profile' && (
          <>
            <Section title="Identity" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name" {...bind('firstName')} />
              <FormField label="Surname" {...bind('surName')} />
              <FormField label="Code" value={c.code} readonly />
              <FormField label="Courier Type" type="select" value={c.type} options={['Master', 'Sub']} />
              {c.type === 'Sub' && (
                <FormField label="Master Courier" type="select" value={masterName ? `${masterName.firstName} ${masterName.surName}` : ''} options={masters.map(m => `${m.firstName} ${m.surName}`)} />
              )}
              <FormField label="Gender" type="select" {...bind('gender')} options={['', 'Male', 'Female']} />
              <FormField label="Date of Birth" type="date" {...bind('dob')} />
              <FormField label="Start Date" type="date" {...bind('startDate')} />
              <FormField label="Finish Date" type="date" {...bind('finishDate')} />
            </div>
            <Section title="Contact" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Personal Mobile" {...bind('phone')} />
              <FormField label="Urgent Mobile (Company)" {...bind('urgentMobile')} />
              <FormField label="Email" {...bind('email')} />
              <FormField label="Home Phone" {...bind('homePhone')} />
              <FormField label="Address" {...bind('address')} full />
            </div>
            <Section title="Emergency / Next of Kin" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Doctor" {...bind('doctor')} />
              <FormField label="Doctor Phone" {...bind('doctorPhone')} />
              <FormField label="Next of Kin" {...bind('nextOfKin')} />
              <FormField label="Relationship" {...bind('nokRelationship')} />
              <FormField label="Next of Kin Address" {...bind('nokAddress')} full />
              <FormField label="Next of Kin Phone" {...bind('nokPhone')} />
            </div>
          </>
        )}

        {tab === 'vehicle' && (
          <>
            <Section title="Vehicle Details" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Vehicle Type" {...bind('vehicle')} />
              {lookupSelect('Make', 'makeId', 'make', vehicleMakes)}
              <FormField label="Model" {...bind('model')} />
              <FormField label="Year" {...bindNum('year')} />
              <FormField label="License Plate" {...bind('rego')} />
            </div>
            <div className="my-2">
              <FormField label="Low Emission Vehicle" type="checkbox" {...bindBool('lowEmission')} />
            </div>
            <Section title="Dimensions & Weight" />
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Max Pallets" {...bindNum('maxPallets')} />
              <FormField label="Tare Weight (kg)" {...bindNum('tareWeight')} />
              <FormField label="Max Carrying Weight (kg)" {...bindNum('maxCarry')} />
              <FormField label="RUC Weight" {...bindNum('rucWeight')} />
              <FormField label="RUC Kms" {...bindNum('rucKms')} />
              <FormField label="RUC Payload" {...bindNum('rucPayload')} />
              <FormField label="Height (m)" {...bindNum('height')} />
              <FormField label="Width (m)" {...bindNum('width')} />
              <FormField label="Length (m)" {...bindNum('length')} />
            </div>
            <Section title="Compliance Dates" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Vehicle Inspection Expiry" type="date" {...bind('inspectionExpiry')} warning={isExpiringSoon(c.inspectionExpiry) ? 'Expiring soon!' : undefined} />
              <FormField label="Registration Expiry" type="date" {...bind('regoExpiry')} warning={isExpiringSoon(c.regoExpiry) ? 'Expiring soon!' : undefined} />
            </div>
          </>
        )}

        {tab === 'licensing' && (
          <>
            <Section title="Driver's License" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Driver's License No" {...bind('dlNo')} />
              <FormField label="Driver's License Expiry" type="date" {...bind('dlExpiry')} warning={isExpiringSoon(c.dlExpiry) ? 'Expiring soon!' : undefined} />
            </div>
            {isExpired(c.dlExpiry) && (
              <div className="bg-amber-50 border border-[#854d0e] text-[#92400e] rounded-lg px-4 py-3.5 text-sm flex items-center gap-2.5 mt-3">
                ⚠️ Driver's license has EXPIRED. Courier must not operate until renewed.
              </div>
            )}
            <Section title="Endorsements" />
            <FormField label="Dangerous Goods" type="checkbox" {...bindBool('dangerousGoods')} />
            {c.dangerousGoods && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <FormField label="DG Certificate Expiry" type="date" {...bind('dgExpiry')} warning={isExpiringSoon(c.dgExpiry) ? 'Expiring soon!' : undefined} />
              </div>
            )}
            <FormField label="Heavy Transport Endorsement" type="checkbox" {...bindBool('hte')} />
            <Section title="DOT Number" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="DOT Number" {...bind('tslNo')} />
            </div>
          </>
        )}

        {tab === 'insurance' && (
          <>
            <Section title="Insurance Details" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Policy Number" {...bind('policyNo')} />
              {lookupSelect('Insurance Company', 'insuranceCoId', 'insuranceCo', insuranceCompanies)}
              {lookupSelect('Carrier Liability Insurer', 'carrierLiabId', 'carrierLiabCompany', insuranceCompanies)}
              {lookupSelect('Public Liability Insurer', 'publicLiabId', 'publicLiabCompany', insuranceCompanies)}
            </div>
            <FormField label="Commercial Insurance" type="checkbox" {...bindBool('commercialIns')} />
          </>
        )}

        {tab === 'financial' && (
          <>
            <div className="bg-blue-50 border border-blue-200 text-blue-600 rounded-lg px-4 py-3.5 text-sm flex items-center gap-2.5 mb-4">
              💡 These are YOUR rates to this courier. Your customers cannot see these.
            </div>
            <Section title="Tax & Banking" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tax ID (EIN)" {...bind('taxId')} />
              <FormField label="Federal Withholding %" {...bindNum('wht')} />
              <FormField label="Bank Account (Routing / Account)" {...bind('bankAcct')} />
            </div>
            <Section title="Pay Rates" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Pay Percentage (%)" {...bindNum('payPct')} />
              <FormField label="Bonus Percentage (%)" {...bindNum('bonusPct')} />
            </div>
            <FormField label="Payroll Registration" type="checkbox" {...bindBool('paydayReg')} />
            <Section title="Compliance Dates" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Contract Signed Date" type="date" {...bind('contractSigned')} />
              <FormField label="Security Check Date" type="date" {...bind('securityCheck')} />
            </div>
          </>
        )}

        {tab === 'device' && (
          <>
            <Section title="Communication Channel" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Channel" type="select" value={c.channel} options={['App', 'SMS', 'Radio']} />
              <FormField label="Device Type" value={c.deviceType} readonly />
            </div>
            <FormField label="Device Admin" type="checkbox" {...bindBool('deviceAdmin')} />
            <Section title="SMS & Network" />
            <FormField label="Carrier Network" type="checkbox" {...bindBool('vodafone')} />
            <FormField label="Send Job via SMS" type="checkbox" {...bindBool('smsJob')} />
            <FormField label="Send Alert SMS" type="checkbox" {...bindBool('smsAlert')} />
            <Section title="Web & Display" />
            <FormField label="Web Enabled" type="checkbox" {...bindBool('webEnabled')} />
            <FormField label="Auto Despatch" type="checkbox" {...bindBool('autoDispatch')} />
            <FormField label="Show Client Phone" type="checkbox" {...bindBool('showClientPhone')} />
            <FormField label="Mobile Advert Courier" type="checkbox" checked={c.mobileAdvert} />
            <FormField label="Display on Web" type="checkbox" {...bindBool('displayWeb')} />
            <Section title="Mobile App Login" />
            {c.hasMobileLogin === false && (
              <div className="inline-block px-2 py-0.5 rounded text-[11px] border border-amber-300 bg-amber-50 text-amber-700 mb-2">● No login yet — this courier can't sign in to the mobile app</div>
            )}
            {c.hasMobileLogin === true && (
              <div className="inline-block px-2 py-0.5 rounded text-[11px] border border-green-200 bg-green-50 text-green-700 mb-2">● Login active — set a new password below to reset it</div>
            )}
            <p className="text-xs text-text-secondary -mt-1 mb-2">
              Set or reset the password the courier signs in to the mobile app with — their username is their <span className="font-medium">email</span>. If they don't have a login yet, this creates one. This is separate from the Save button below and applies immediately.
            </p>
            {!c.email?.trim() && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-xs mb-2">
                Add an email on the Profile tab first — it's the courier's sign-in username.
              </div>
            )}
            <div className="flex items-end gap-2 max-w-lg">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-text-secondary uppercase tracking-wide">New Password</label>
                <PasswordInput value={loginPassword} onChange={setLoginPassword} maxLength={100} placeholder="Password to give the courier" />
              </div>
              <button
                type="button"
                onClick={handleResetLogin}
                disabled={loginSaving || !loginPassword.trim() || !c.email?.trim()}
                className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loginSaving ? 'Setting…' : 'Set / Reset Password'}
              </button>
            </div>
            {loginError && (
              <div className="mt-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs max-w-lg">⚠️ {loginError}</div>
            )}
            {loginSuccess && (
              <div className="mt-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs max-w-lg">✅ Mobile app password set.</div>
            )}
            <Section title="Security & POD" />
            <FormField label="POD Required" type="checkbox" {...bindBool('podRequired')} />
            <Section title="Working Hours" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Expected Start Time" type="time" {...bind('startTime')} />
              <FormField label="Expected End Time" type="time" {...bind('endTime')} />
            </div>
          </>
        )}

        {tab === 'documents' && (
          <CourierDocumentsTab courierId={c.id} />
        )}

        {tab === 'notes' && (
          <>
            <Section title="Notes" />
            <FormField label="Notes" type="textarea" {...bind('notes')} full rows={5} />
            <Section title="Training" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Training Hours (Initial)" value={String(c.trainingInit ?? '')} readonly />
              <FormField label="Training Hours (Follow-up)" value={String(c.trainingFollow ?? '')} readonly />
            </div>
            <Section title="Audit Trail" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Created" value={c.created} readonly />
              <FormField label="Created By" value={c.createdBy} readonly />
              <FormField label="Last Modified" value={c.modified} readonly />
              <FormField label="Last Modified By" value={c.modifiedBy} readonly />
            </div>
          </>
        )}
      </div>

      {/* Save status banners */}
      {saveError && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          ⚠️ {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          ✅ Changes saved.
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2.5 mt-4">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleCancel}
          disabled={!dirty || saving}
          className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={() => navigate('/fleet')}
          className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all"
        >
          Back to Fleet
        </button>
      </div>
    </>
  );
}

function StatusBadgeDoc({ status }: { status: DocumentStatus }) {
  const map: Record<DocumentStatus, { icon: string; label: string; bg: string; color: string }> = {
    Current: { icon: '✅', label: 'Current', bg: 'bg-green-50', color: 'text-green-700' },
    ExpiringSoon: { icon: '⚠️', label: 'Expiring Soon', bg: 'bg-amber-50', color: 'text-amber-700' },
    Expired: { icon: '❌', label: 'Expired', bg: 'bg-red-50', color: 'text-red-700' },
    Superseded: { icon: '📁', label: 'Superseded', bg: 'bg-gray-50', color: 'text-gray-500' },
  };
  const s = map[status] || map.Current;
  return <span className={`text-xs px-2.5 py-0.5 rounded-lg border ${s.bg} ${s.color}`}>{s.icon} {s.label}</span>;
}

function CourierDocumentsTab({ courierId }: { courierId: number }) {
  const { types } = useDocumentTypes();
  const { documents, upload, deleteDoc, verify, getDownloadUrl } = useCourierDocuments(courierId);
  const summary = useComplianceSummary(types, documents);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTypeId, setUploadTypeId] = useState<number | undefined>();

  const activeTypes = types.filter(dt => dt.active && (dt.appliesTo === 'ActiveCourier' || dt.appliesTo === 'Both'));

  const handleDownload = async (docId: number) => {
    const url = await getDownloadUrl(docId);
    if (url) window.open(url, '_blank');
  };

  return (
    <>
      {/* Compliance summary bar */}
      <div className="bg-surface-light border border-border rounded-lg px-4 py-3 mb-4 flex items-center gap-3 text-sm">
        <span className="font-medium text-brand-dark">Compliance:</span>
        <span className="text-green-600">{summary.current} current</span>
        <span className="text-text-secondary">·</span>
        {summary.expiring > 0 && <><span className="text-amber-600">{summary.expiring} expiring</span><span className="text-text-secondary">·</span></>}
        {summary.expired > 0 && <><span className="text-red-600">{summary.expired} expired</span><span className="text-text-secondary">·</span></>}
        {summary.missing > 0 && <span className="text-red-500">{summary.missing} missing</span>}
        {summary.missing === 0 && summary.expired === 0 && summary.expiring === 0 && (
          <span className="text-green-600">All documents current ✅</span>
        )}
        <span className="ml-auto text-text-secondary">{summary.current + summary.expiring}/{summary.total} mandatory</span>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">Documents</h3>
        <button
          onClick={() => { setUploadTypeId(undefined); setShowUpload(true); }}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow"
        >
          Upload Document
        </button>
      </div>

      {/* Document type rows */}
      {activeTypes.map((dt) => {
        const doc = documents.find(d => d.documentTypeId === dt.id && d.status !== 'Superseded');
        return (
          <div key={dt.id} className="flex items-center gap-3 py-3 border-b border-border last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-brand-dark flex items-center gap-2">
                {dt.name}
                {dt.mandatory && <span className="text-[10px] px-1.5 py-0 rounded bg-red-50 text-red-600 border border-red-200 uppercase">Required</span>}
              </div>
              {doc ? (
                <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{doc.fileName}</span>
                  <span>· Uploaded {new Date(doc.uploadedDate).toLocaleDateString()}</span>
                  {doc.expiryDate && <span>· Expires {new Date(doc.expiryDate).toLocaleDateString()}</span>}
                  {doc.aiConfidence != null && (
                    <span className={doc.aiConfidence >= 95 ? 'text-green-600' : doc.aiConfidence >= 70 ? 'text-amber-600' : 'text-red-500'}>
                      AI {doc.aiConfidence.toFixed(0)}%
                    </span>
                  )}
                  {doc.humanVerified && <span className="text-green-600">✓ Verified</span>}
                </div>
              ) : (
                <div className="text-xs text-red-400 mt-0.5">
                  {dt.mandatory ? '⚠ Not uploaded — required' : 'Not uploaded'}
                </div>
              )}
            </div>

            {doc ? (
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadgeDoc status={doc.status} />
                <button onClick={() => handleDownload(doc.id)} className="text-xs text-brand-cyan hover:underline">Download</button>
                {!doc.humanVerified && (
                  <button onClick={() => verify(doc.id)} className="text-xs text-green-600 hover:underline">Verify</button>
                )}
                <button onClick={() => { if (confirm('Delete this document?')) deleteDoc(doc.id); }} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            ) : (
              <button
                onClick={() => { setUploadTypeId(dt.id); setShowUpload(true); }}
                className="text-xs bg-brand-cyan text-brand-dark px-3 py-1.5 rounded-md font-medium hover:shadow-cyan-glow shrink-0"
              >
                Upload
              </button>
            )}
          </div>
        );
      })}

      {showUpload && (
        <DocumentUpload
          documentTypes={activeTypes}
          selectedTypeId={uploadTypeId}
          onUpload={upload}
          onClose={() => setShowUpload(false)}
        />
      )}
    </>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="text-sm font-bold text-brand-cyan mt-5 mb-3 pb-1.5 border-b border-border first:mt-0">
      {title}
    </div>
  );
}
