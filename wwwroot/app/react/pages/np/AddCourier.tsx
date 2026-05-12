import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import StepWizard from '@/components/common/StepWizard';
import FormField from '@/components/common/FormField';
import ScanToFill, { AiConfidenceBadge } from '@/components/common/ScanToFill';
import { courierService } from '@/services/np_courierService';
import { fleetService } from '@/services/np_fleetService';
import { useDocumentTypes } from '@/hooks/useDocuments';

const steps = ['Basic Info', 'Vehicle', 'Licensing', 'Documents', 'Review & Save'];

interface UploadedDoc {
  docTypeId: number;
  fileName: string;
  fileSize: number;
  status: 'uploaded' | 'processing' | 'verified';
  expiryDate?: string;
  extractedFields?: { name: string; value: string; confidence: number }[];
  aiConfidence?: number;
}

// Mock AI extraction
function mockExtract(docTypeName: string): { fields: { name: string; value: string; confidence: number }[]; confidence: number } {
  const extractions: Record<string, { fields: { name: string; value: string; confidence: number }[]; confidence: number }> = {
    "Driver's License": {
      confidence: 96,
      fields: [
        { name: 'License Number', value: 'DL-29384756', confidence: 98 },
        { name: 'Expiry Date', value: '2027-08-15', confidence: 96 },
        { name: 'Full Name', value: '', confidence: 0 },
        { name: 'Document Type', value: "Driver's License", confidence: 92 },
      ],
    },
    'Vehicle Registration': {
      confidence: 91,
      fields: [
        { name: 'Plate Number', value: 'ABC123', confidence: 94 },
        { name: 'Expiry Date', value: '2026-11-30', confidence: 88 },
        { name: 'Vehicle Make', value: 'Toyota', confidence: 90 },
      ],
    },
    'default': {
      confidence: 85,
      fields: [
        { name: 'Document Type', value: docTypeName, confidence: 78 },
        { name: 'Expiry Date', value: '2027-03-01', confidence: 72 },
      ],
    },
  };
  return extractions[docTypeName] || extractions['default'];
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 95 ? 'text-green-600 bg-green-50 border-green-200'
    : confidence >= 70 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${color}`}>
      AI {confidence}%
    </span>
  );
}

function QuickAddForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const fleets = fleetService.getAll();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '', surname: '', email: '', mobile: '', company: '',
    vehicleType: '', notes: '', fleet: '', location: '',
  });
  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { navigate('/fleet'); }, 600);
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-1">Add Agent — Self-Found Lead</h2>
      <p className="text-sm text-text-secondary mb-5">Enter the details you have. The agent will be created in your fleet and can complete compliance later.</p>

      <div className="bg-white border border-border rounded-lg p-5 space-y-5">
        <div>
          <div className="text-sm font-bold text-brand-cyan mb-3 pb-1.5 border-b border-border">Contact Details</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">First Name <span className="text-red-500">*</span></label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="e.g. John" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Surname <span className="text-red-500">*</span></label>
              <input value={form.surname} onChange={e => set('surname', e.target.value)} placeholder="e.g. Smith" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Mobile <span className="text-red-500">*</span></label>
              <input value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+1 555 123 4567" />
            </div>
            <div className="flex flex-col gap-1 col-span-full">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Company / Trading Name</label>
              <input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Optional — sole trader or company name" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-brand-cyan mb-3 pb-1.5 border-b border-border">Assignment</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Vehicle Type</label>
              <select value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)}>
                <option value="">Select…</option>
                <option>Car</option><option>Van</option><option>Truck</option><option>Motorcycle</option><option>Bicycle</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Fleet</label>
              <select value={form.fleet} onChange={e => set('fleet', e.target.value)}>
                <option value="">— Select Fleet —</option>
                {fleets.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Location / Depot</label>
              <select value={form.location} onChange={e => set('location', e.target.value)}>
                <option value="">— Select —</option>
                <option>Chicago</option><option>Dallas</option><option>Houston</option><option>Los Angeles</option><option>Miami</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-brand-cyan mb-3 pb-1.5 border-b border-border">Notes</div>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full border border-border rounded-md px-3 py-2 text-sm" rows={3}
            placeholder="How did you find this lead? Any context for the NP team…" />
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2.5 text-xs">
          💡 Once saved, the agent will appear in your fleet. They'll need to complete compliance documents and training before being approved for client work.
        </div>
      </div>

      <div className="flex gap-2.5 mt-4">
        <button onClick={handleSave} disabled={saving || !form.firstName.trim() || !form.surname.trim() || !form.mobile.trim()}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-5 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Agent'}
        </button>
        <button onClick={onCancel} className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all">
          Cancel
        </button>
      </div>
    </>
  );
}

export default function AddCourier() {
  const [step, setStep] = useState(1);
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'quick' ? 'quick' as const : null;
  const [mode, setMode] = useState<'pipeline' | 'quick' | null>(initialMode);
  const navigate = useNavigate();
  const { role } = useRole();
  const masters = courierService.getMasters();
  const fleets = fleetService.getAll();
  const { types: docTypes } = useDocumentTypes();
  const activeTypes = docTypes.filter(dt => dt.active && (dt.appliesTo === 'ActiveCourier' || dt.appliesTo === 'Both'));

  // Form field values (for scan-to-fill auto-population)
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  // Track which fields were AI-filled + their confidence
  const [aiFields, setAiFields] = useState<Record<string, number>>({});
  // Track which doc types were scanned in which step
  const [scannedDocs, setScannedDocs] = useState<Record<string, number>>({}); // docTypeName → step number

  const updateField = (field: string, value: string) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  };

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
  const [processingDocId, setProcessingDocId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetDocId, setUploadTargetDocId] = useState<number | null>(null);

  const handleFileSelect = useCallback((docTypeId: number, file: File) => {
    const docType = activeTypes.find(dt => dt.id === docTypeId);
    if (!docType) return;

    setProcessingDocId(docTypeId);

    // Simulate AI processing
    setTimeout(() => {
      const extraction = mockExtract(docType.name);
      const expiryField = extraction.fields.find(f => f.name.toLowerCase().includes('expiry'));

      setUploadedDocs(prev => [
        ...prev.filter(d => d.docTypeId !== docTypeId),
        {
          docTypeId,
          fileName: file.name,
          fileSize: file.size,
          status: extraction.confidence >= 95 ? 'verified' : 'uploaded',
          expiryDate: expiryField?.value,
          extractedFields: extraction.fields,
          aiConfidence: extraction.confidence,
        },
      ]);
      setProcessingDocId(null);
      setExpandedDocId(docTypeId);
    }, 1500);
  }, [activeTypes]);

  const triggerUpload = (docTypeId: number) => {
    setUploadTargetDocId(docTypeId);
    fileInputRef.current?.click();
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadTargetDocId != null) {
      handleFileSelect(uploadTargetDocId, file);
    }
    e.target.value = '';
  };

  const removeDoc = (docTypeId: number) => {
    setUploadedDocs(prev => prev.filter(d => d.docTypeId !== docTypeId));
    if (expandedDocId === docTypeId) setExpandedDocId(null);
  };

  const mandatoryCount = activeTypes.filter(dt => dt.mandatory).length;
  const mandatoryUploaded = activeTypes.filter(dt => dt.mandatory && uploadedDocs.some(d => d.docTypeId === dt.id)).length;

  // Show mode picker if tenant/dfadmin and no mode selected yet
  if ((role === 'tenant' || role === 'dfadmin') && mode === null) {
    return (
      <>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Add Agent</h2>
            <p className="text-sm text-text-secondary mt-1">How would you like to add this agent?</p>
          </div>
          <button onClick={() => setMode('quick')}
            className="bg-blue-600 text-white font-medium px-5 py-2.5 rounded-md text-sm hover:bg-blue-700 transition-colors">
            + Add Agent Manually
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => setMode('quick')}
            className="bg-white border border-border rounded-xl p-6 text-left hover:border-blue-500 hover:shadow-md transition-all group">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-bold text-lg mb-1 group-hover:text-blue-600">Self-Found Lead</h3>
            <p className="text-sm text-text-secondary">You've found this agent yourself. Enter their basic details — they'll complete compliance later.</p>
          </button>
          <button onClick={() => setMode('pipeline')}
            className="bg-white border border-border rounded-xl p-6 text-left hover:border-brand-cyan hover:shadow-md transition-all group">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-bold text-lg mb-1 group-hover:text-brand-cyan">Full Recruitment</h3>
            <p className="text-sm text-text-secondary">Full onboarding wizard with document scanning, AI extraction, licensing, and compliance checks.</p>
          </button>
        </div>
        <button onClick={() => navigate('/fleet')} className="mt-4 text-sm text-text-secondary hover:text-text-primary">← Back to Fleet</button>
      </>
    );
  }

  if (mode === 'quick') {
    return <QuickAddForm onCancel={() => role === 'tenant' || role === 'dfadmin' ? setMode(null) : navigate('/fleet')} />;
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xl font-bold">Add New Courier</h2>
        {(role === 'tenant' || role === 'dfadmin') && (
          <button onClick={() => setMode(null)} className="text-xs text-brand-cyan hover:underline">← Change mode</button>
        )}
      </div>
      <StepWizard steps={steps} current={step} />
      <div className="bg-white border border-border rounded-lg p-5">
        {step === 1 && (
          <>
            <ScanToFill
              label="Scan Driver's License to auto-fill"
              docTypeName="Driver's License"
              onExtracted={(fields) => {
                const mapping: Record<string, string> = {
                  firstName: 'firstName', lastName: 'surname', dob: 'dob',
                  gender: 'gender', address: 'address', licenseNumber: 'licenseNumber',
                };
                const newValues: Record<string, string> = {};
                const newAi: Record<string, number> = {};
                for (const [key, { value, confidence }] of Object.entries(fields)) {
                  const formKey = mapping[key] || key;
                  newValues[formKey] = value;
                  newAi[formKey] = confidence;
                }
                setFormValues(prev => ({ ...prev, ...newValues }));
                setAiFields(prev => ({ ...prev, ...newAi }));
                setScannedDocs(prev => ({ ...prev, "Driver's License": 1 }));
              }}
            />
            <div className="text-sm font-bold text-brand-cyan mb-3 pb-1.5 border-b border-border">Basic Information</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">First Name</label>
                  {aiFields.firstName && <AiConfidenceBadge confidence={aiFields.firstName} />}
                </div>
                <input value={formValues.firstName || ''} onChange={e => updateField('firstName', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Surname</label>
                  {aiFields.surname && <AiConfidenceBadge confidence={aiFields.surname} />}
                </div>
                <input value={formValues.surname || ''} onChange={e => updateField('surname', e.target.value)} />
              </div>
              <FormField label="Courier Type" type="select" value="Sub" options={['Master', 'Sub']} />
              <FormField label="Master Courier" type="select" options={['— Select —', ...masters.map(m => `${m.firstName} ${m.surName}`)]} />
              <FormField label="Fleet" type="select" options={['— Select Fleet —', ...fleets.map(f => f.name)]} />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Gender</label>
                  {aiFields.gender && <AiConfidenceBadge confidence={aiFields.gender} />}
                </div>
                <select value={formValues.gender || 'Male'} onChange={e => updateField('gender', e.target.value)}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Date of Birth</label>
                  {aiFields.dob && <AiConfidenceBadge confidence={aiFields.dob} />}
                </div>
                <input type="date" value={formValues.dob || ''} onChange={e => updateField('dob', e.target.value)} />
              </div>
              <FormField label="Personal Mobile" value={formValues.mobile || ''} onChange={v => updateField('mobile', String(v))} />
              <FormField label="Email" type="email" value={formValues.email || ''} onChange={v => updateField('email', String(v))} />
              <div className="flex flex-col gap-1 col-span-full">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Address</label>
                  {aiFields.address && <AiConfidenceBadge confidence={aiFields.address} />}
                </div>
                <input value={formValues.address || ''} onChange={e => updateField('address', e.target.value)} />
              </div>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <ScanToFill
              label="Scan Vehicle Registration to auto-fill"
              docTypeName="Vehicle Registration"
              onExtracted={(fields) => {
                const mapping: Record<string, string> = {
                  plateNumber: 'licensePlate', make: 'vMake', model: 'vModel',
                  year: 'vYear', regoExpiry: 'regoExpiry', vehicleType: 'vType',
                };
                const newValues: Record<string, string> = {};
                const newAi: Record<string, number> = {};
                for (const [key, { value, confidence }] of Object.entries(fields)) {
                  const formKey = mapping[key] || key;
                  newValues[formKey] = value;
                  newAi[formKey] = confidence;
                }
                setFormValues(prev => ({ ...prev, ...newValues }));
                setAiFields(prev => ({ ...prev, ...newAi }));
                setScannedDocs(prev => ({ ...prev, "Vehicle Registration": 2 }));
              }}
            />
            <div className="text-sm font-bold text-brand-cyan mb-3 pb-1.5 border-b border-border">Vehicle Details</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Vehicle Type</label>
                  {aiFields.vType && <AiConfidenceBadge confidence={aiFields.vType} />}
                </div>
                <select value={formValues.vType || ''} onChange={e => updateField('vType', e.target.value)}>
                  <option value="">Select…</option>
                  <option>Car</option><option>Van</option><option>Truck</option><option>Motorcycle</option><option>Bicycle</option><option>Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Make</label>
                  {aiFields.vMake && <AiConfidenceBadge confidence={aiFields.vMake} />}
                </div>
                <select value={formValues.vMake || ''} onChange={e => updateField('vMake', e.target.value)}>
                  <option value="">Select…</option>
                  {['Toyota','Ford','Mercedes','Volkswagen','Isuzu','Fiat','Subaru','Honda','Mazda','Hyundai','Yamaha','Other'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Model</label>
                  {aiFields.vModel && <AiConfidenceBadge confidence={aiFields.vModel} />}
                </div>
                <input value={formValues.vModel || ''} onChange={e => updateField('vModel', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Year</label>
                  {aiFields.vYear && <AiConfidenceBadge confidence={aiFields.vYear} />}
                </div>
                <input value={formValues.vYear || ''} onChange={e => updateField('vYear', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">License Plate</label>
                  {aiFields.licensePlate && <AiConfidenceBadge confidence={aiFields.licensePlate} />}
                </div>
                <input value={formValues.licensePlate || ''} onChange={e => updateField('licensePlate', e.target.value)} />
              </div>
              <FormField label="Vehicle Inspection" type="date" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Registration Expiry</label>
                  {aiFields.regoExpiry && <AiConfidenceBadge confidence={aiFields.regoExpiry} />}
                </div>
                <input type="date" value={formValues.regoExpiry || ''} onChange={e => updateField('regoExpiry', e.target.value)} />
              </div>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <ScanToFill
              label="Scan Driver's License to auto-fill"
              docTypeName="Driver's License"
              onExtracted={(fields) => {
                const newValues: Record<string, string> = {};
                const newAi: Record<string, number> = {};
                if (fields.licenseNumber) { newValues.dlNo = fields.licenseNumber.value; newAi.dlNo = fields.licenseNumber.confidence; }
                if (fields.licenseExpiry) { newValues.dlExpiry = fields.licenseExpiry.value; newAi.dlExpiry = fields.licenseExpiry.confidence; }
                setFormValues(prev => ({ ...prev, ...newValues }));
                setAiFields(prev => ({ ...prev, ...newAi }));
                setScannedDocs(prev => ({ ...prev, "Driver's License": prev["Driver's License"] || 3 }));
              }}
            />
            <div className="text-sm font-bold text-brand-cyan mb-3 pb-1.5 border-b border-border">Driver's License</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Driver's License No</label>
                  {aiFields.dlNo && <AiConfidenceBadge confidence={aiFields.dlNo} />}
                </div>
                <input value={formValues.dlNo || ''} onChange={e => updateField('dlNo', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Driver's License Expiry</label>
                  {aiFields.dlExpiry && <AiConfidenceBadge confidence={aiFields.dlExpiry} />}
                </div>
                <input type="date" value={formValues.dlExpiry || ''} onChange={e => updateField('dlExpiry', e.target.value)} />
              </div>
            </div>
            <div className="text-sm font-bold text-brand-cyan mt-5 mb-3 pb-1.5 border-b border-border">Endorsements</div>
            <FormField label="Dangerous Goods" type="checkbox" />
            <FormField label="Heavy Transport Endorsement" type="checkbox" />

            <ScanToFill
              label="Scan Insurance Certificate to auto-fill"
              docTypeName="Insurance Certificate"
              onExtracted={(fields) => {
                const newValues: Record<string, string> = {};
                const newAi: Record<string, number> = {};
                if (fields.policyNumber) { newValues.policyNo = fields.policyNumber.value; newAi.policyNo = fields.policyNumber.confidence; }
                if (fields.insuranceCompany) { newValues.insurerName = fields.insuranceCompany.value; newAi.insurerName = fields.insuranceCompany.confidence; }
                setFormValues(prev => ({ ...prev, ...newValues }));
                setAiFields(prev => ({ ...prev, ...newAi }));
                setScannedDocs(prev => ({ ...prev, "Insurance Certificate": 3 }));
              }}
            />
            <div className="text-sm font-bold text-brand-cyan mt-5 mb-3 pb-1.5 border-b border-border">Insurance</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Policy Number</label>
                  {aiFields.policyNo && <AiConfidenceBadge confidence={aiFields.policyNo} />}
                </div>
                <input value={formValues.policyNo || ''} onChange={e => updateField('policyNo', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Insurance Company</label>
                  {aiFields.insurerName && <AiConfidenceBadge confidence={aiFields.insurerName} />}
                </div>
                <select value={formValues.insurerName || ''} onChange={e => updateField('insurerName', e.target.value)}>
                  <option value="">Select…</option>
                  {['State Farm','Progressive','GEICO','Allstate','Liberty Mutual','Other'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              onChange={onFileInput}
            />

            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-brand-cyan pb-1.5 border-b border-border mb-2">Upload Documents</div>
                <p className="text-xs text-text-secondary">
                  Upload required documents. AI will automatically extract key information.
                </p>
              </div>
              <div className="text-xs text-text-secondary">
                {mandatoryUploaded}/{mandatoryCount} required uploaded
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: mandatoryCount > 0 ? `${(mandatoryUploaded / mandatoryCount) * 100}%` : '0%',
                  backgroundColor: mandatoryUploaded === mandatoryCount ? '#16a34a' : '#3bc7f4',
                }}
              />
            </div>

            {/* Tip */}
            <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2.5 text-xs flex items-center gap-2 mb-4">
              📸 Take photos of documents with your phone camera, or drag and drop files here. AI reads them automatically.
            </div>

            {/* Already captured from previous steps */}
            {Object.keys(scannedDocs).length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
                <div className="text-xs font-semibold text-green-700 mb-2">Already captured from previous steps:</div>
                {Object.entries(scannedDocs).map(([docName, stepNum]) => (
                  <div key={docName} className="flex items-center gap-2 text-xs text-green-600 py-0.5">
                    <span>✅</span>
                    <span className="font-medium">{docName}</span>
                    <span className="text-green-500">— captured in Step {stepNum}</span>
                  </div>
                ))}
                {activeTypes.filter(dt => !Object.keys(scannedDocs).some(name =>
                  dt.name.toLowerCase().includes(name.toLowerCase().split(' ')[0])
                )).length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-green-200">
                    {activeTypes.filter(dt => !Object.keys(scannedDocs).some(name =>
                      dt.name.toLowerCase().includes(name.toLowerCase().split(' ')[0])
                    )).map(dt => (
                      <div key={dt.id} className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
                        <span>⬜</span>
                        <span>{dt.name}</span>
                        <span className="text-gray-400">— not yet uploaded</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Document cards */}
            <div className="space-y-3">
              {activeTypes.map((dt) => {
                const uploaded = uploadedDocs.find(d => d.docTypeId === dt.id);
                const isProcessing = processingDocId === dt.id;
                const isExpanded = expandedDocId === dt.id;

                return (
                  <div
                    key={dt.id}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      uploaded ? 'border-green-300 bg-green-50/30' : 'border-gray-200 bg-white'
                    }`}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileSelect(dt.id, file);
                    }}
                  >
                    {/* Card header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => setExpandedDocId(isExpanded ? null : dt.id)}
                    >
                      <span className="text-lg">
                        {isProcessing ? '⏳' : uploaded ? '✅' : dt.mandatory ? '📄' : '📎'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-brand-dark flex items-center gap-2">
                          {dt.name}
                          {dt.mandatory && (
                            <span className="text-[10px] px-1.5 py-0 rounded bg-red-50 text-red-600 border border-red-200 uppercase">Required</span>
                          )}
                        </div>
                        {uploaded && (
                          <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-2">
                            <span>{uploaded.fileName}</span>
                            <span>({(uploaded.fileSize / 1024).toFixed(0)} KB)</span>
                            {uploaded.aiConfidence != null && <ConfidenceBadge confidence={uploaded.aiConfidence} />}
                          </div>
                        )}
                        {isProcessing && (
                          <div className="text-xs text-brand-cyan mt-0.5 flex items-center gap-1.5">
                            <span className="inline-block w-3 h-3 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin" />
                            Analysing document with AI…
                          </div>
                        )}
                        {!uploaded && !isProcessing && (
                          <div className="text-xs text-text-secondary mt-0.5">{dt.instructions || 'Upload or drag and drop'}</div>
                        )}
                      </div>

                      {!uploaded && !isProcessing && (
                        <button
                          onClick={e => { e.stopPropagation(); triggerUpload(dt.id); }}
                          className="text-xs bg-brand-cyan text-brand-dark px-3 py-1.5 rounded-md font-medium hover:shadow-cyan-glow shrink-0"
                        >
                          Upload
                        </button>
                      )}
                      {uploaded && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); triggerUpload(dt.id); }}
                            className="text-xs text-brand-cyan hover:underline"
                          >
                            Replace
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); removeDoc(dt.id); }}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      <svg
                        className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>

                    {/* Expanded: AI extraction results */}
                    {isExpanded && uploaded?.extractedFields && (
                      <div className="border-t border-gray-200 px-4 py-3 bg-white">
                        <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                          AI Extracted Fields
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {uploaded.extractedFields.map((field, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="text-[11px] text-text-secondary">{field.name}</div>
                                <input
                                  type="text"
                                  defaultValue={field.value}
                                  className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-brand-cyan focus:border-brand-cyan"
                                />
                              </div>
                              <ConfidenceBadge confidence={field.confidence} />
                            </div>
                          ))}
                        </div>
                        {uploaded.expiryDate && (
                          <div className="mt-2 text-xs text-text-secondary">
                            📅 Expiry: <span className="font-medium text-brand-dark">{uploaded.expiryDate}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Skippable note */}
            {mandatoryUploaded < mandatoryCount && (
              <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2.5 text-xs">
                ⚠ {mandatoryCount - mandatoryUploaded} required document{mandatoryCount - mandatoryUploaded > 1 ? 's' : ''} not yet uploaded.
                Documents can also be uploaded later from the courier's Documents tab.
              </div>
            )}
          </>
        )}
        {step === 5 && (
          <>
            <div className={`${mandatoryUploaded === mandatoryCount ? 'bg-green-50 border-green-200 text-green-600' : 'bg-amber-50 border-amber-200 text-amber-600'} border rounded-lg px-4 py-3.5 text-sm flex items-center gap-2.5 mb-4`}>
              {mandatoryUploaded === mandatoryCount
                ? '✅ All required documents uploaded. Review and save the courier.'
                : `⚠ ${mandatoryCount - mandatoryUploaded} required document${mandatoryCount - mandatoryUploaded > 1 ? 's' : ''} still missing. You can still save and upload later.`
              }
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div>
                <div className="text-sm font-bold text-brand-cyan mb-2 pb-1.5 border-b border-border">Documents Summary</div>
                <div className="grid grid-cols-2 gap-2">
                  {activeTypes.map(dt => {
                    const doc = uploadedDocs.find(d => d.docTypeId === dt.id);
                    return (
                      <div key={dt.id} className="flex items-center gap-2 text-sm py-1">
                        <span>{doc ? '✅' : dt.mandatory ? '❌' : '—'}</span>
                        <span className={doc ? 'text-brand-dark' : dt.mandatory ? 'text-red-500' : 'text-text-secondary'}>
                          {dt.name}
                        </span>
                        {doc && <span className="text-xs text-text-secondary ml-auto">{doc.fileName}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-text-secondary text-sm pt-2 border-t border-border">
                <p>All fields can be edited after creation from the Courier Setup screen.</p>
                <p className="mt-1">The new courier will appear in your Fleet Overview and can be assigned jobs immediately.</p>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2.5 mt-4">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all">
            ← Previous
          </button>
        )}
        {step < 5 && (
          <button onClick={() => setStep(step + 1)} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow">
            Next →
          </button>
        )}
        {step === 5 && (
          <button onClick={() => navigate('/fleet')} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow">
            Save Courier
          </button>
        )}
        <button onClick={() => navigate('/fleet')} className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all">
          Cancel
        </button>
      </div>
    </>
  );
}
