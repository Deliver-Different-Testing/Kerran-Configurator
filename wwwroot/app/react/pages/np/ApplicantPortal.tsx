import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { recruitmentService } from '@/services/np_recruitmentService';

// ═══════════════════════════════════════════════════════
// DFRNT Courier Portal — Mobile-First Applicant Onboarding
// ═══════════════════════════════════════════════════════
// Route: /portal/apply/:tenantSlug?
// Standalone public page — no auth, no sidebar, no layout

// ── Country Detection ──────────────────────────────────

type Country = 'NZ' | 'US';

function detectCountry(): Country {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('Pacific/Auckland') || tz.startsWith('NZ')) return 'NZ';
    const locale = navigator.language || '';
    if (locale.includes('NZ') || locale === 'en-NZ') return 'NZ';
  } catch { /* fall through */ }
  return 'US';
}

function detectCountryFromPhone(phone: string): Country | null {
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('+64') || cleaned.startsWith('0064')) return 'NZ';
  if (cleaned.startsWith('+1') || cleaned.startsWith('001')) return 'US';
  return null;
}

// ── Step Definitions ───────────────────────────────────

const STEPS = [
  { key: 'register', label: 'Register', icon: '👤' },
  { key: 'personal', label: 'Personal', icon: '📋' },
  { key: 'vehicle', label: 'Vehicle', icon: '🚗' },
  { key: 'documents', label: 'Documents', icon: '📄' },
  { key: 'declaration', label: 'Submit', icon: '✍️' },
] as const;

// ── Mock Tenant Resolver ───────────────────────────────

interface TenantBrand {
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
}

function resolveTenant(slug?: string): TenantBrand {
  // In production this would be an API call
  const tenants: Record<string, TenantBrand> = {
    'dfrnt': { slug: 'dfrnt', name: 'Deliver Different', logoUrl: '/dfrnt-logo.png', primaryColor: '#0d0c2c' },
    'urgent-army': { slug: 'urgent-army', name: 'Urgent Army', logoUrl: null, primaryColor: '#0d0c2c' },
  };
  return tenants[slug || ''] || { slug: slug || 'default', name: 'Courier Application', logoUrl: null, primaryColor: '#0d0c2c' };
}

// ── Mock Document Types for Portal ─────────────────────

interface PortalDocType {
  id: number;
  name: string;
  mandatory: boolean;
  instructions: string | null;
  hasTemplate: boolean;
  category: string;
  countriesOnly?: Country[];
}

const PORTAL_DOC_TYPES: PortalDocType[] = [
  { id: 1, name: "Driver's License", mandatory: true, instructions: 'Upload a clear photo of front and back.', hasTemplate: false, category: 'Licensing' },
  { id: 2, name: 'Vehicle Registration', mandatory: true, instructions: 'Current registration document.', hasTemplate: false, category: 'Vehicle' },
  { id: 3, name: 'Insurance Certificate', mandatory: true, instructions: 'Proof of vehicle insurance with minimum coverage.', hasTemplate: false, category: 'Insurance' },
  { id: 4, name: 'WOF Certificate', mandatory: true, instructions: 'Current Warrant of Fitness.', hasTemplate: false, category: 'Vehicle', countriesOnly: ['NZ'] },
  { id: 5, name: 'TSL Certificate', mandatory: false, instructions: 'Transport Service License (if applicable).', hasTemplate: false, category: 'Licensing', countriesOnly: ['NZ'] },
  { id: 6, name: 'DOT Registration', mandatory: true, instructions: 'Department of Transportation registration.', hasTemplate: false, category: 'Licensing', countriesOnly: ['US'] },
  { id: 7, name: 'Dangerous Goods Certificate', mandatory: false, instructions: 'Only if carrying DG cargo.', hasTemplate: false, category: 'Licensing' },
];

// ── Confidence Badge (reused from DocumentUpload) ──────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 95)
    return <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">✅ {confidence}%</span>;
  if (confidence >= 70)
    return <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">⚠️ {confidence}%</span>;
  return <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">❌ {confidence}%</span>;
}

// ── Mock AI Extraction ─────────────────────────────────

interface MockExtraction {
  docType: string;
  confidence: number;
  fields: { name: string; value: string; confidence: number }[];
  expiryDate?: string;
}

function simulateAiExtraction(file: File, docType: PortalDocType): Promise<MockExtraction> {
  return new Promise(resolve => {
    setTimeout(() => {
      const base: MockExtraction = {
        docType: docType.name,
        confidence: 88 + Math.random() * 12,
        fields: [],
      };
      if (docType.name.includes('License')) {
        base.fields = [
          { name: 'License Number', value: 'AB' + Math.floor(100000 + Math.random() * 900000), confidence: 96 },
          { name: 'Full Name', value: 'John Smith', confidence: 99 },
          { name: 'Expiry Date', value: '2027-06-15', confidence: 94 },
          { name: 'Class', value: '1, 2', confidence: 82 },
        ];
        base.expiryDate = '2027-06-15';
      } else if (docType.name.includes('Registration') || docType.name.includes('WOF')) {
        base.fields = [
          { name: 'Plate Number', value: 'ABC' + Math.floor(100 + Math.random() * 900), confidence: 97 },
          { name: 'Expiry Date', value: '2026-12-01', confidence: 91 },
        ];
        base.expiryDate = '2026-12-01';
      } else if (docType.name.includes('Insurance')) {
        base.fields = [
          { name: 'Policy Number', value: 'INS-' + Math.floor(100000 + Math.random() * 900000), confidence: 93 },
          { name: 'Insurer', value: 'State Farm', confidence: 88 },
          { name: 'Coverage Amount', value: '$1,000,000', confidence: 85 },
          { name: 'Expiry Date', value: '2027-01-15', confidence: 92 },
        ];
        base.expiryDate = '2027-01-15';
      } else {
        base.fields = [
          { name: 'Document Type', value: docType.name, confidence: 75 },
        ];
      }
      resolve(base);
    }, 1500 + Math.random() * 1000);
  });
}

// ── Local Storage Save/Resume ──────────────────────────

const STORAGE_KEY = 'dfrnt_portal_application';

interface SavedApplication {
  step: number;
  form: Record<string, string>;
  uploadedDocs: UploadedDoc[];
  country: Country;
  tenantSlug: string;
  savedAt: string;
}

interface UploadedDoc {
  docTypeId: number;
  fileName: string;
  extraction: MockExtraction | null;
  status: 'uploaded' | 'processing' | 'verified';
}

function saveProgress(data: SavedApplication) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function loadProgress(tenantSlug: string): SavedApplication | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedApplication;
    if (saved.tenantSlug !== tenantSlug) return null;
    // Check if saved within last 7 days
    const savedDate = new Date(saved.savedAt);
    if (Date.now() - savedDate.getTime() > 7 * 24 * 60 * 60 * 1000) return null;
    return saved;
  } catch { return null; }
}

function clearProgress() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function ApplicantPortal() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const tenant = useMemo(() => resolveTenant(tenantSlug), [tenantSlug]);
  const [country, setCountry] = useState<Country>(detectCountry);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(false);

  // ── Form State ─────────────────────────────────────
  const [form, setForm] = useState<Record<string, string>>({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', phone: '', mobile: '', dateOfBirth: '',
    address: '', city: '', state: '', postcode: '', countryField: '',
    driversLicenceNo: '', vehicleRegistrationNo: '',
    vehicleType: '', vehicleMake: '', vehicleModel: '', vehicleYear: '', vehiclePlate: '',
    // NZ-specific
    irdNumber: '', gstRegistered: 'No', tslNo: '', wofExpiry: '',
    dlClass: '', dlEndorsements: '',
    // US-specific
    ssn: '', dotNumber: '', mcNumber: '', ein: '', usState: '',
    bankRoutingNumber: '', bankAccountNo: '', bankAccountName: '',
    // Common
    nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '', nextOfKinAddress: '',
  });

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [signed, setSigned] = useState(false);
  const [declarationName, setDeclarationName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [activeUploadDocId, setActiveUploadDocId] = useState<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [currentExtraction, setCurrentExtraction] = useState<MockExtraction | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Resume Detection ───────────────────────────────
  useEffect(() => {
    const saved = loadProgress(tenant.slug);
    if (saved && saved.step > 0) {
      setResumePrompt(true);
    }
  }, [tenant.slug]);

  const handleResume = () => {
    const saved = loadProgress(tenant.slug);
    if (saved) {
      setForm(prev => ({ ...prev, ...saved.form }));
      setUploadedDocs(saved.uploadedDocs);
      setStep(saved.step);
      setCountry(saved.country);
    }
    setResumePrompt(false);
  };

  // ── Auto-save ──────────────────────────────────────
  useEffect(() => {
    if (step > 0 && !submitted) {
      saveProgress({
        step,
        form,
        uploadedDocs,
        country,
        tenantSlug: tenant.slug,
        savedAt: new Date().toISOString(),
      });
    }
  }, [step, form, uploadedDocs, country, tenant.slug, submitted]);

  // ── Country Detection from Phone ───────────────────
  useEffect(() => {
    const detected = detectCountryFromPhone(form.phone || form.mobile);
    if (detected) setCountry(detected);
  }, [form.phone, form.mobile]);

  // ── Form Helpers ───────────────────────────────────
  const u = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (validationErrors[field]) setValidationErrors(v => { const n = { ...v }; delete n[field]; return n; });
  };

  const inputClass = "w-full px-3 py-3 text-[15px] border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40 focus:border-[#3bc7f4] transition-all";
  const labelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block";
  const errorClass = "text-xs text-red-500 mt-1";
  const sectionClass = "bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4 shadow-sm";

  // ── Available Doc Types for Country ────────────────
  const docTypes = PORTAL_DOC_TYPES.filter(d =>
    !d.countriesOnly || d.countriesOnly.includes(country)
  );

  // ── Signature Pad ──────────────────────────────────
  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x * (canvas.width / rect.width), y * (canvas.height / rect.height));
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x * (canvas.width / rect.width), y * (canvas.height / rect.height));
    ctx.strokeStyle = '#0d0c2c';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }, []);

  const stopDraw = useCallback(() => { drawingRef.current = false; setSigned(true); }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
  };

  // ── Validation ─────────────────────────────────────
  const validateStep = (s: number): boolean => {
    const errors: Record<string, string> = {};

    if (s === 0) {
      if (!form.firstName.trim()) errors.firstName = 'Required';
      if (!form.lastName.trim()) errors.lastName = 'Required';
      if (!form.email.trim()) errors.email = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email';
      if (!form.phone.trim() && !form.mobile.trim()) errors.phone = 'Phone or mobile required';
    }

    if (s === 1) {
      if (!form.address.trim()) errors.address = 'Required';
      if (!form.city.trim()) errors.city = 'Required';
      if (!form.driversLicenceNo.trim()) errors.driversLicenceNo = 'Required';
      if (country === 'NZ' && !form.irdNumber.trim()) errors.irdNumber = 'Required';
      if (country === 'US' && !form.ssn.trim()) errors.ssn = 'Required';
    }

    if (s === 2) {
      if (!form.vehicleType) errors.vehicleType = 'Required';
      if (!form.vehiclePlate.trim()) errors.vehiclePlate = 'Required';
    }

    if (s === 4) {
      if (!agreedToTerms) errors.agree = 'You must agree to the declaration';
      if (!declarationName.trim()) errors.declarationName = 'Full name required';
      if (!signed) errors.signature = 'Signature required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canProceed = () => {
    if (step === 0) return !!(form.firstName && form.lastName && form.email && (form.phone || form.mobile));
    if (step === 4) return agreedToTerms && signed && declarationName.trim();
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  // ── Document Upload ────────────────────────────────
  const handleFileSelect = async (docType: PortalDocType, file: File) => {
    setUploadingFile(true);
    setCurrentExtraction(null);

    try {
      const extraction = await simulateAiExtraction(file, docType);
      setCurrentExtraction(extraction);

      // Auto-populate form fields from extraction
      for (const field of extraction.fields) {
        if (field.name === 'License Number' && field.confidence >= 80) u('driversLicenceNo', field.value);
        if (field.name === 'Plate Number' && field.confidence >= 80) u('vehiclePlate', field.value);
      }

      setUploadedDocs(docs => [
        ...docs.filter(d => d.docTypeId !== docType.id),
        { docTypeId: docType.id, fileName: file.name, extraction, status: extraction.confidence >= 95 ? 'verified' : 'uploaded' },
      ]);
    } finally {
      setUploadingFile(false);
    }
  };

  // ── Submit ─────────────────────────────────────────
  const handleSubmit = () => {
    if (!validateStep(4)) return;

    recruitmentService.createApplicant({
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone || form.mobile || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      postcode: form.postcode || null,
      vehicleType: form.vehicleType || null,
      vehicleMake: form.vehicleMake || null,
      vehicleModel: form.vehicleModel || null,
      vehicleYear: form.vehicleYear ? parseInt(form.vehicleYear) : null,
      vehiclePlate: form.vehiclePlate || null,
      bankAccountName: form.bankAccountName || null,
      bankAccountNumber: form.bankAccountNo || null,
      bankBSB: form.bankRoutingNumber || null,
      nextOfKinName: form.nextOfKinName || null,
      nextOfKinPhone: form.nextOfKinPhone || null,
      nextOfKinRelationship: form.nextOfKinRelationship || null,
      declarationSigned: true,
    });

    clearProgress();
    setSubmitted(true);
    setStep(5);
  };

  // ── Country Flag ───────────────────────────────────
  const countryFlag = country === 'NZ' ? '🇳🇿' : '🇺🇸';

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#f4f2f1]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* ── Resume Prompt ────────────────────────────── */}
      {resumePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#0d0c2c]">Resume Application?</h3>
            <p className="text-sm text-gray-600">We found a saved application. Would you like to continue where you left off?</p>
            <div className="flex gap-3">
              <button onClick={handleResume} className="flex-1 bg-[#3bc7f4] text-white py-2.5 rounded-xl font-medium text-sm hover:bg-[#3bc7f4]/90">
                Resume
              </button>
              <button onClick={() => { clearProgress(); setResumePrompt(false); }} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50">
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────── */}
      <header className="bg-[#0d0c2c] text-white safe-area-top">
        <div className="max-w-2xl mx-auto px-4 py-5 sm:py-6">
          <div className="flex items-center gap-3">
            {tenant.logoUrl && (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-auto" />
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">{tenant.name}</h1>
              <p className="text-xs sm:text-sm text-white/50 mt-0.5">Courier Application {countryFlag}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Progress Bar ─────────────────────────────── */}
      {step < 5 && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-2xl mx-auto px-4 py-3">
            {/* Mobile: simple progress bar */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#0d0c2c]">{STEPS[step].label}</span>
                <span className="text-xs text-gray-400">Step {step + 1} of {STEPS.length}</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3bc7f4] rounded-full transition-all duration-500"
                  style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Desktop: step indicators */}
            <div className="hidden sm:flex items-center gap-1">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex-1 flex items-center gap-1.5">
                  <button
                    onClick={() => i < step && setStep(i)}
                    disabled={i > step}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                      i < step
                        ? 'bg-[#3bc7f4] text-white cursor-pointer hover:bg-[#3bc7f4]/80'
                        : i === step
                        ? 'bg-[#0d0c2c] text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {i < step ? '✓' : i + 1}
                  </button>
                  <span className={`text-xs whitespace-nowrap ${i === step ? 'text-[#0d0c2c] font-semibold' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded ${i < step ? 'bg-[#3bc7f4]' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 pb-32">

        {/* ═══ STEP 0: Register ═══ */}
        {step === 0 && (
          <div className="space-y-5">
            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Get Started</h2>
              <p className="text-sm text-gray-500">Enter your basic details to begin the application.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input className={inputClass} value={form.firstName} onChange={e => u('firstName', e.target.value)} placeholder="John" />
                  {validationErrors.firstName && <p className={errorClass}>{validationErrors.firstName}</p>}
                </div>
                <div>
                  <label className={labelClass}>Last Name *</label>
                  <input className={inputClass} value={form.lastName} onChange={e => u('lastName', e.target.value)} placeholder="Smith" />
                  {validationErrors.lastName && <p className={errorClass}>{validationErrors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className={labelClass}>Email *</label>
                <input type="email" className={inputClass} value={form.email} onChange={e => u('email', e.target.value)} placeholder="john@example.com" />
                {validationErrors.email && <p className={errorClass}>{validationErrors.email}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input type="tel" className={inputClass} value={form.phone} onChange={e => u('phone', e.target.value)}
                    placeholder={country === 'NZ' ? '+64 21 123 4567' : '+1 (555) 123-4567'} />
                  {validationErrors.phone && <p className={errorClass}>{validationErrors.phone}</p>}
                </div>
                <div>
                  <label className={labelClass}>Mobile</label>
                  <input type="tel" className={inputClass} value={form.mobile} onChange={e => u('mobile', e.target.value)} />
                </div>
              </div>

              {/* Country indicator */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs text-gray-500">
                <span className="text-base">{countryFlag}</span>
                <span>Detected region: <strong className="text-gray-700">{country === 'NZ' ? 'New Zealand' : 'United States'}</strong></span>
                <button
                  onClick={() => setCountry(c => c === 'NZ' ? 'US' : 'NZ')}
                  className="ml-auto text-[#3bc7f4] font-medium hover:underline"
                >
                  Switch to {country === 'NZ' ? 'US' : 'NZ'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 1: Personal Details ═══ */}
        {step === 1 && (
          <div className="space-y-5">
            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Personal Details</h2>

              <div>
                <label className={labelClass}>Date of Birth</label>
                <input type="date" className={inputClass} value={form.dateOfBirth} onChange={e => u('dateOfBirth', e.target.value)} />
              </div>

              <div>
                <label className={labelClass}>Address *</label>
                <input className={inputClass} value={form.address} onChange={e => u('address', e.target.value)} placeholder="Street address" />
                {validationErrors.address && <p className={errorClass}>{validationErrors.address}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>City *</label>
                  <input className={inputClass} value={form.city} onChange={e => u('city', e.target.value)} />
                  {validationErrors.city && <p className={errorClass}>{validationErrors.city}</p>}
                </div>
                <div>
                  <label className={labelClass}>{country === 'NZ' ? 'Region' : 'State'}</label>
                  <input className={inputClass} value={form.state} onChange={e => u('state', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>{country === 'NZ' ? 'Postcode' : 'ZIP Code'}</label>
                  <input className={inputClass} value={form.postcode} onChange={e => u('postcode', e.target.value)} />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">
                {country === 'NZ' ? "Driver's Licence" : "Driver's License"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{country === 'NZ' ? 'Licence Number' : 'License Number'} *</label>
                  <input className={inputClass} value={form.driversLicenceNo} onChange={e => u('driversLicenceNo', e.target.value)} />
                  {validationErrors.driversLicenceNo && <p className={errorClass}>{validationErrors.driversLicenceNo}</p>}
                </div>
                {country === 'NZ' && (
                  <>
                    <div>
                      <label className={labelClass}>Licence Class</label>
                      <select className={inputClass} value={form.dlClass} onChange={e => u('dlClass', e.target.value)}>
                        <option value="">Select...</option>
                        <option value="1">Class 1 (Car, Light Vehicle)</option>
                        <option value="2">Class 2 (Medium Rigid)</option>
                        <option value="3">Class 3 (Medium Combination)</option>
                        <option value="4">Class 4 (Heavy Rigid)</option>
                        <option value="5">Class 5 (Heavy Combination)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Endorsements</label>
                      <input className={inputClass} value={form.dlEndorsements} onChange={e => u('dlEndorsements', e.target.value)} placeholder="e.g. D, P, V, W" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">
                {country === 'NZ' ? 'Tax & Banking' : 'Tax & Financial'}
              </h2>

              {country === 'NZ' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>IRD Number *</label>
                      <input className={inputClass} value={form.irdNumber} onChange={e => u('irdNumber', e.target.value)} placeholder="123-456-789" />
                      {validationErrors.irdNumber && <p className={errorClass}>{validationErrors.irdNumber}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>GST Registered</label>
                      <select className={inputClass} value={form.gstRegistered} onChange={e => u('gstRegistered', e.target.value)}>
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Bank Account (XX-XXXX-XXXXXXXX-XXX)</label>
                    <input className={inputClass} value={form.bankAccountNo} onChange={e => u('bankAccountNo', e.target.value)} placeholder="01-0123-0123456-00" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>SSN / EIN *</label>
                      <input className={inputClass} value={form.ssn} onChange={e => u('ssn', e.target.value)} placeholder="XXX-XX-XXXX" />
                      {validationErrors.ssn && <p className={errorClass}>{validationErrors.ssn}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>DOT Number</label>
                      <input className={inputClass} value={form.dotNumber} onChange={e => u('dotNumber', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>MC Number</label>
                      <input className={inputClass} value={form.mcNumber} onChange={e => u('mcNumber', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Bank Routing Number</label>
                      <input className={inputClass} value={form.bankRoutingNumber} onChange={e => u('bankRoutingNumber', e.target.value)} maxLength={9} />
                    </div>
                    <div>
                      <label className={labelClass}>Bank Account Number</label>
                      <input className={inputClass} value={form.bankAccountNo} onChange={e => u('bankAccountNo', e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Emergency Contact</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Name</label>
                  <input className={inputClass} value={form.nextOfKinName} onChange={e => u('nextOfKinName', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Relationship</label>
                  <input className={inputClass} value={form.nextOfKinRelationship} onChange={e => u('nextOfKinRelationship', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input type="tel" className={inputClass} value={form.nextOfKinPhone} onChange={e => u('nextOfKinPhone', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Address</label>
                  <input className={inputClass} value={form.nextOfKinAddress} onChange={e => u('nextOfKinAddress', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Vehicle Details ═══ */}
        {step === 2 && (
          <div className="space-y-5">
            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Vehicle Information</h2>
              <p className="text-sm text-gray-500">Details of the vehicle you'll use for deliveries.</p>

              <div>
                <label className={labelClass}>Vehicle Type *</label>
                <select className={inputClass} value={form.vehicleType} onChange={e => u('vehicleType', e.target.value)}>
                  <option value="">Select type...</option>
                  <option value="Hatchback">Hatchback</option>
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Station Wagon">Station Wagon</option>
                  <option value="Van">Van</option>
                  <option value="Truck">Truck</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="E-Bike">E-Bike</option>
                </select>
                {validationErrors.vehicleType && <p className={errorClass}>{validationErrors.vehicleType}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Make</label>
                  <input className={inputClass} value={form.vehicleMake} onChange={e => u('vehicleMake', e.target.value)} placeholder="Toyota" />
                </div>
                <div>
                  <label className={labelClass}>Model</label>
                  <input className={inputClass} value={form.vehicleModel} onChange={e => u('vehicleModel', e.target.value)} placeholder="Corolla" />
                </div>
                <div>
                  <label className={labelClass}>Year</label>
                  <input type="number" className={inputClass} value={form.vehicleYear} onChange={e => u('vehicleYear', e.target.value)} placeholder="2022" />
                </div>
                <div>
                  <label className={labelClass}>Registration Plate *</label>
                  <input className={inputClass} value={form.vehiclePlate} onChange={e => u('vehiclePlate', e.target.value.toUpperCase())} placeholder="ABC123" />
                  {validationErrors.vehiclePlate && <p className={errorClass}>{validationErrors.vehiclePlate}</p>}
                </div>
              </div>

              {country === 'NZ' && (
                <div>
                  <label className={labelClass}>WOF Expiry Date</label>
                  <input type="date" className={inputClass} value={form.wofExpiry} onChange={e => u('wofExpiry', e.target.value)} />
                </div>
              )}
            </div>

            {country === 'NZ' && (
              <div className={sectionClass}>
                <h2 className="text-lg font-bold text-[#0d0c2c]">Transport Licence</h2>
                <div>
                  <label className={labelClass}>TSL Number</label>
                  <input className={inputClass} value={form.tslNo} onChange={e => u('tslNo', e.target.value)} placeholder="Transport Service License number (if applicable)" />
                </div>
              </div>
            )}

            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">
                {country === 'NZ' ? 'Vehicle Registration' : 'Registration Details'}
              </h2>
              <div>
                <label className={labelClass}>Registration Number</label>
                <input className={inputClass} value={form.vehicleRegistrationNo} onChange={e => u('vehicleRegistrationNo', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: Documents ═══ */}
        {step === 3 && (
          <div className="space-y-5">
            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Upload Documents</h2>
              <p className="text-sm text-gray-500">
                Upload required documents. Our AI will automatically extract key information for you.
              </p>

              <div className="space-y-3">
                {docTypes.map(dt => {
                  const uploaded = uploadedDocs.find(d => d.docTypeId === dt.id);
                  const isActive = activeUploadDocId === dt.id;

                  return (
                    <div key={dt.id} className={`border rounded-xl overflow-hidden transition-all ${
                      uploaded ? 'border-green-300 bg-green-50/30' : 'border-gray-200'
                    }`}>
                      {/* Doc Type Header */}
                      <button
                        onClick={() => setActiveUploadDocId(isActive ? null : dt.id)}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{uploaded ? '✅' : dt.mandatory ? '📄' : '📎'}</span>
                          <div>
                            <div className="text-sm font-semibold text-[#0d0c2c]">
                              {dt.name}
                              {dt.mandatory && <span className="text-red-400 ml-1">*</span>}
                            </div>
                            {uploaded && (
                              <div className="text-xs text-green-600 mt-0.5">{uploaded.fileName}</div>
                            )}
                          </div>
                        </div>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isActive ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </button>

                      {/* Expanded Upload Area */}
                      {isActive && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                          {dt.instructions && (
                            <p className="text-xs text-gray-500 italic">{dt.instructions}</p>
                          )}

                          {/* Drop / Camera Zone */}
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#3bc7f4] transition-colors active:bg-gray-50"
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.bmp"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileSelect(dt, f);
                                e.target.value = '';
                              }}
                            />
                            {uploadingFile && activeUploadDocId === dt.id ? (
                              <div className="space-y-2">
                                <div className="animate-spin text-2xl">⏳</div>
                                <p className="text-sm text-[#3bc7f4] font-medium">AI is analyzing your document...</p>
                              </div>
                            ) : (
                              <div>
                                <div className="text-3xl mb-2">📸</div>
                                <p className="text-sm text-gray-600">
                                  <span className="text-[#3bc7f4] font-semibold">Take a photo</span> or upload a file
                                </p>
                                <p className="text-xs text-gray-400 mt-1">PDF, JPEG, PNG · Max 10MB</p>
                              </div>
                            )}
                          </div>

                          {/* AI Extraction Results */}
                          {uploaded?.extraction && (
                            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-[#0d0c2c]">🤖 AI Extraction</span>
                                <ConfidenceBadge confidence={Math.round(uploaded.extraction.confidence)} />
                              </div>

                              {uploaded.extraction.expiryDate && (
                                <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                  <span>📅</span>
                                  <span className="text-blue-700">Expiry: <strong>{uploaded.extraction.expiryDate}</strong></span>
                                </div>
                              )}

                              <div className="divide-y divide-gray-100">
                                {uploaded.extraction.fields.map((f, i) => (
                                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                                    <span className="text-gray-500">{f.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-[#0d0c2c]">{f.value}</span>
                                      <ConfidenceBadge confidence={Math.round(f.confidence)} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Declaration & Submit ═══ */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Review Summary */}
            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Review Your Application</h2>

              <div className="divide-y divide-gray-100 text-sm">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium text-[#0d0c2c]">{form.firstName} {form.lastName}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium text-[#0d0c2c]">{form.email}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Phone</span>
                  <span className="font-medium text-[#0d0c2c]">{form.phone || form.mobile || '—'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium text-[#0d0c2c]">{form.city}{form.state ? `, ${form.state}` : ''}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Region</span>
                  <span className="font-medium text-[#0d0c2c]">{country === 'NZ' ? 'New Zealand' : 'United States'} {countryFlag}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">{country === 'NZ' ? 'Licence' : 'License'} #</span>
                  <span className="font-medium text-[#0d0c2c]">{form.driversLicenceNo || '—'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Vehicle</span>
                  <span className="font-medium text-[#0d0c2c]">{form.vehicleType} {form.vehicleMake} {form.vehicleModel}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Plate</span>
                  <span className="font-medium text-[#0d0c2c]">{form.vehiclePlate || '—'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Documents</span>
                  <span className="font-medium text-[#0d0c2c]">{uploadedDocs.length} uploaded</span>
                </div>
              </div>

              <button onClick={() => setStep(0)} className="text-sm text-[#3bc7f4] font-medium hover:underline">
                ← Edit details
              </button>
            </div>

            {/* Contract */}
            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Contract</h2>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                View Current Contract
              </button>
            </div>

            {/* Declaration */}
            <div className={sectionClass}>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Declaration</h2>

              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 leading-relaxed max-h-40 overflow-y-auto">
                <p className="mb-2">I hereby declare that all information provided in this application is true and correct to the best of my knowledge. I understand that any false or misleading statements may result in the termination of my engagement as a courier.</p>
                <p className="mb-2">I agree to comply with all applicable laws, regulations, and company policies in the performance of courier services. I acknowledge that I am responsible for maintaining valid insurance, registration, and licenses for my vehicle.</p>
                <p>I consent to background checks and verification of the information provided herein. I understand this is an independent contractor arrangement and not an employment relationship.</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={e => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[#3bc7f4] focus:ring-[#3bc7f4]"
                />
                <span className="text-sm text-gray-700">I agree to the terms and conditions above</span>
              </label>
              {validationErrors.agree && <p className={errorClass}>{validationErrors.agree}</p>}

              <div>
                <label className={labelClass}>Full Name *</label>
                <input
                  className={inputClass}
                  value={declarationName}
                  onChange={e => setDeclarationName(e.target.value)}
                  placeholder="Type your full legal name"
                />
                {validationErrors.declarationName && <p className={errorClass}>{validationErrors.declarationName}</p>}
              </div>

              <div>
                <label className={labelClass}>Signature *</label>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={180}
                  className="w-full border border-gray-300 rounded-xl cursor-crosshair bg-white touch-none"
                  style={{ height: '120px' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
                <button onClick={clearSignature} className="mt-2 text-xs text-[#3bc7f4] font-medium hover:underline">
                  Clear signature
                </button>
                {validationErrors.signature && <p className={errorClass}>{validationErrors.signature}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 5: Confirmation ═══ */}
        {step === 5 && submitted && (
          <div className={sectionClass + ' text-center'}>
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#0d0c2c] mb-2">Application Submitted!</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              Thank you for applying to <strong>{tenant.name}</strong>. Our team will review your application and be in touch shortly.
            </p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 inline-block">
              Confirmation sent to <strong className="text-[#0d0c2c]">{form.email}</strong>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Navigation (sticky on mobile) ──────── */}
      {step < 5 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-40">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-5 py-3 text-sm font-medium text-gray-600 hover:text-gray-800 active:bg-gray-50 rounded-xl"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" /></svg>
                Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-6 py-3 text-sm font-semibold bg-[#3bc7f4] text-white rounded-xl hover:bg-[#3bc7f4]/90 active:bg-[#3bc7f4]/80 disabled:opacity-40 shadow-sm transition-all"
              >
                Continue
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" /></svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 active:bg-green-800 disabled:opacity-40 shadow-sm transition-all"
              >
                Submit Application
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L7 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
