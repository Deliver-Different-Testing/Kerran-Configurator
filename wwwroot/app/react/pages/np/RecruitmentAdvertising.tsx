import { useState, useMemo, useRef, useEffect } from 'react';
import { complianceProfileService } from '@/services/np_complianceProfileService';
import type { ComplianceProfile } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Country = 'NZ' | 'US';

interface AdPlatform {
  name: string;
  icon: string;
  url: string;
  cost: string;
  tips: string;
  countries: Country[];
}

interface MergeField {
  key: string;
  label: string;
  placeholder: string;
}

interface SourceStat {
  source: string;
  count: number;
  percentage: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MERGE_FIELDS: MergeField[] = [
  { key: '{company_name}', label: 'Company Name', placeholder: 'Acme Couriers' },
  { key: '{city}', label: 'City', placeholder: 'Auckland' },
  { key: '{pay_range}', label: 'Pay Range', placeholder: '$25-35/hr' },
  { key: '{vehicle_type}', label: 'Vehicle Type', placeholder: 'Van / Truck / Car' },
];

const AD_PLATFORMS: AdPlatform[] = [
  // Both
  { name: 'Meta / Facebook Jobs', icon: '📘', url: 'https://www.facebook.com/jobs/create/', cost: 'Free – $50/day', tips: 'Target by location + "delivery driver" interest. Use video ads for 3x engagement.', countries: ['NZ', 'US'] },
  { name: 'Indeed', icon: '🟦', url: 'https://employers.indeed.com/p/post-job', cost: 'Free (sponsored $5-15/day)', tips: 'Sponsored posts get 5x more applicants. Include pay range — Indeed ranks these higher.', countries: ['NZ', 'US'] },
  { name: 'LinkedIn', icon: '🔗', url: 'https://www.linkedin.com/talent/post-a-job', cost: '$10-30/day', tips: 'Best for experienced owner-drivers. Use "Easy Apply" for higher conversion.', countries: ['NZ', 'US'] },
  // NZ only
  { name: 'TradeMe Jobs', icon: '🟠', url: 'https://www.trademe.co.nz/a/jobs/sell', cost: '$79-199 NZD per listing', tips: 'NZ\'s #1 job site. "Courier" and "Delivery Driver" are top searched terms.', countries: ['NZ'] },
  { name: 'Seek NZ', icon: '🟣', url: 'https://talent.seek.co.nz/post-a-job', cost: '$175-330 NZD per listing', tips: 'Premium listings get 3x views. Include "immediate start" for urgency.', countries: ['NZ'] },
  { name: 'MyJobSpace', icon: '🟢', url: 'https://www.myjobspace.co.nz/Employers/PostJob', cost: 'Free – $99 NZD', tips: 'Good budget option. Free tier gets decent traffic in regional NZ.', countries: ['NZ'] },
  // US only
  { name: 'Craigslist', icon: '📋', url: 'https://post.craigslist.org/', cost: '$10-75 USD per post', tips: 'Post in "transportation" > "delivery". Include clear pay info. Repost weekly.', countries: ['US'] },
  { name: 'ZipRecruiter', icon: '🟩', url: 'https://www.ziprecruiter.com/post-a-job', cost: '$16-24/day USD', tips: 'AI matching sends your job to qualified drivers. Great for owner-operator roles.', countries: ['US'] },
  { name: 'CDLjobs.com', icon: '🚛', url: 'https://www.cdljobs.com/post', cost: '$199-499 USD/month', tips: 'Niche CDL driver board. If you need Class A/B drivers, this is where they look.', countries: ['US'] },
];

const NZ_TEMPLATE = `🚚 {company_name} — Delivery Drivers Wanted in {city}!

We're looking for reliable courier drivers to join our team in {city}.

What's on offer:
• Pay: {pay_range}
• Vehicle: {vehicle_type}
• Flexible hours — morning, afternoon, and evening shifts available
• Ongoing work with a growing delivery network

What we need from you:
• Full NZ driver licence (Class 1 minimum)
• Reliable {vehicle_type} (or we can discuss options)
• Good knowledge of the {city} area
• Smartphone for our delivery app
• Clean criminal history (MoJ check required)

About us:
{company_name} is part of the DFRNT delivery network, connecting businesses with professional courier drivers across New Zealand. We value reliability, professionalism, and great customer service.

Ready to hit the road? Apply now — it takes under 5 minutes!`;

const US_TEMPLATE = `🚚 {company_name} — Delivery Drivers Wanted in {city}!

We're hiring independent contractor delivery drivers in the {city} area.

Compensation & Benefits:
• Pay: {pay_range}
• Vehicle: {vehicle_type}
• Flexible scheduling — you choose your hours
• Weekly direct deposit
• Steady route availability

Requirements:
• Valid US driver's license
• Reliable {vehicle_type} (or lease options available)
• Clean driving record (MVR check required)
• Smartphone with data plan
• Pass background check and drug screening
• Proof of auto insurance (if using personal vehicle)

About {company_name}:
{company_name} partners with the DFRNT delivery network to provide reliable last-mile delivery services. We're growing fast and need dependable drivers to keep up with demand.

1099 Independent Contractor position. Apply today — takes under 5 minutes!`;

// Mock analytics
const MOCK_SOURCE_STATS: SourceStat[] = [
  { source: 'Direct Link / QR Code', count: 47, percentage: 34 },
  { source: 'Indeed', count: 28, percentage: 20 },
  { source: 'Facebook Jobs', count: 22, percentage: 16 },
  { source: 'TradeMe Jobs', count: 18, percentage: 13 },
  { source: 'LinkedIn', count: 11, percentage: 8 },
  { source: 'Seek NZ', count: 7, percentage: 5 },
  { source: 'Other / Unknown', count: 5, percentage: 4 },
];

// ─── QR Code (SVG via API) ──────────────────────────────────────────────────

function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  // Use a public QR code API for SVG generation
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&format=svg&margin=8`;
  return (
    <img
      src={url}
      alt="QR Code"
      width={size}
      height={size}
      className="rounded-lg border border-border"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}

// ─── Clipboard helper ────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        copied
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-brand-cyan text-brand-dark border border-transparent hover:shadow-cyan-glow'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// ─── UTM Generator ───────────────────────────────────────────────────────────

function buildUTM(baseUrl: string, platform: string): string {
  const params = new URLSearchParams({
    utm_source: platform.toLowerCase().replace(/[\s\/]+/g, '-'),
    utm_medium: 'job-board',
    utm_campaign: 'driver-recruitment',
    utm_content: new Date().toISOString().slice(0, 7), // YYYY-MM
  });
  return `${baseUrl}?${params.toString()}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RecruitmentAdvertising() {
  const [country, setCountry] = useState<Country>('NZ');
  const [tenantSlug, setTenantSlug] = useState('premier-express');
  const [domain, setDomain] = useState('deliver-different-testing.github.io');
  const [activeTab, setActiveTab] = useState<'url' | 'platforms' | 'template' | 'tracking'>('url');
  const [complianceProfiles, setComplianceProfiles] = useState<ComplianceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  useEffect(() => {
    setComplianceProfiles(complianceProfileService.getAll().filter(p => p.active));
  }, []);

  // Logo management — default from tenant DB, per-ad override
  const [defaultLogo] = useState<string | null>(null); // Would come from master controller API
  const [adLogo, setAdLogo] = useState<string | null>(null);
  const [adBrandName, setAdBrandName] = useState('');
  const activeLogo = adLogo || defaultLogo;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setAdLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Merge field values
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({
    '{company_name}': 'Premier Express',
    '{city}': country === 'NZ' ? 'Auckland' : 'Dallas',
    '{pay_range}': country === 'NZ' ? '$25-35/hr' : '$22-32/hr',
    '{vehicle_type}': 'Van',
  });

  const [customTemplate, setCustomTemplate] = useState('');
  const activeCompanyName = adBrandName || fieldValues['{company_name}'] || tenantSlug;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update defaults when country changes
  useEffect(() => {
    setFieldValues(prev => ({
      ...prev,
      '{city}': country === 'NZ' ? 'Auckland' : 'Dallas',
      '{pay_range}': country === 'NZ' ? '$25-35/hr' : '$22-32/hr',
    }));
    setCustomTemplate('');
  }, [country]);

  const selectedProfile = complianceProfiles.find(p => p.id === selectedProfileId);
  const portalUrl = `https://${domain}/NP-Agent-Management/portal/apply/${tenantSlug}${selectedProfileId ? `?profile=${selectedProfileId}` : ''}`;

  const baseTemplate = country === 'NZ' ? NZ_TEMPLATE : US_TEMPLATE;
  const activeTemplate = customTemplate || baseTemplate;

  const renderedTemplate = useMemo(() => {
    let result = activeTemplate;
    for (const [key, val] of Object.entries(fieldValues)) {
      result = result.split(key).join(val);
    }
    return result;
  }, [activeTemplate, fieldValues]);

  const filteredPlatforms = AD_PLATFORMS.filter(p => p.countries.includes(country));

  const tabs = [
    { id: 'url' as const, label: 'Recruitment URL', icon: '🔗' },
    { id: 'platforms' as const, label: 'Ad Platforms', icon: '📢' },
    { id: 'template' as const, label: 'Job Description', icon: '📝' },
    { id: 'tracking' as const, label: 'Tracking', icon: '📊' },
  ];

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Recruitment Advertising</h2>
          <p className="text-sm text-text-secondary mt-1">Generate recruitment links, post to job boards, and track applicant sources.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Region:</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['NZ', 'US'] as Country[]).map(c => (
              <button
                key={c}
                onClick={() => setCountry(c)}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  country === c
                    ? 'bg-brand-dark text-white'
                    : 'bg-white text-text-secondary hover:bg-gray-50'
                }`}
              >
                {c === 'NZ' ? '🇳🇿 New Zealand' : '🇺🇸 United States'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs — always visible */}
      <div className="flex gap-1 mb-6 bg-white rounded-lg border border-border p-1 sticky top-0 z-10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-brand-dark text-white shadow-sm'
                : 'text-text-secondary hover:bg-gray-50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──── Tab: Recruitment URL ──── */}
      {activeTab === 'url' && (
        <div className="space-y-4">
          {/* URL Config */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="font-bold mb-4">Tenant Portal URL</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Tenant Slug</label>
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={e => setTenantSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                />
              </div>
            </div>

            {/* Compliance Profile Selector */}
            <div className="mb-4">
              <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Recruiting For (Compliance Profile)</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedProfileId(null)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    !selectedProfileId
                      ? 'bg-[#0d0c2c] text-white border-[#0d0c2c]'
                      : 'bg-white text-text-secondary border-border hover:border-[#3bc7f4]/40'
                  }`}
                >
                  All Roles
                </button>
                {complianceProfiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      selectedProfileId === p.id
                        ? 'bg-[#0d0c2c] text-white border-[#0d0c2c]'
                        : 'bg-white text-text-secondary border-border hover:border-[#3bc7f4]/40'
                    }`}
                  >
                    {p.name}
                    <span className="ml-1.5 text-[10px] opacity-60">({p.requirements.length} reqs)</span>
                  </button>
                ))}
              </div>
              {selectedProfile && (
                <div className="mt-2 text-xs text-text-secondary bg-[#f4f2f1] rounded-lg p-3">
                  <span className="font-medium">{selectedProfile.name}:</span> {selectedProfile.description}
                  <span className="ml-2 text-[#3bc7f4]">
                    — {selectedProfile.requirements.filter(r => r.mandatory).length} mandatory requirements
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 bg-surface-light rounded-lg p-4 border border-border">
              <code className="flex-1 text-sm font-mono text-brand-dark break-all">{portalUrl}</code>
              <CopyButton text={portalUrl} label="Copy URL" />
            </div>
          </div>

          {/* Ad Branding — per-ad logo & name override */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="font-bold mb-1">Ad Branding</h3>
            <p className="text-xs text-text-secondary mb-4">
              Your default logo comes from the master tenant config. Override it here to use a different brand, franchise name, or go incognito for competitive roles.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Logo upload */}
              <div className="sm:col-span-1">
                <label className="text-xs text-text-secondary uppercase tracking-wide block mb-2">Portal Logo</label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:border-brand-cyan/50 transition-colors min-h-[120px]">
                  {activeLogo ? (
                    <div className="relative group">
                      <img src={activeLogo} alt="Ad logo" className="h-16 w-auto object-contain" />
                      <button
                        onClick={() => setAdLogo(null)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >×</button>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-xl bg-brand-dark flex items-center justify-center text-white text-xl font-bold">
                        {activeCompanyName.charAt(0)}
                      </div>
                      <span className="text-xs text-text-muted">Using initial</span>
                    </>
                  )}
                  <label className="cursor-pointer text-xs font-medium text-brand-cyan hover:text-brand-cyan/80 transition-colors">
                    Upload logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                  <span className="text-[10px] text-text-muted">PNG, JPG — max 2MB</span>
                </div>
              </div>

              {/* Brand name override */}
              <div className="sm:col-span-2 space-y-4">
                <div>
                  <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Display Name (optional)</label>
                  <input
                    type="text"
                    value={adBrandName}
                    onChange={e => setAdBrandName(e.target.value)}
                    placeholder={`Default: ${fieldValues['{company_name}'] || tenantSlug}`}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  />
                  <p className="text-[10px] text-text-muted mt-1">Use a different brand name for this ad. Leave empty to use your tenant name.</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-amber-500 text-sm">💡</span>
                  <div className="text-xs text-amber-800">
                    <strong>Incognito recruiting:</strong> Use a generic name like "Leading Courier Company" if you don't want competitors to know you're hiring. The applicant sees this branding on the sign-up portal.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code + Preview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="font-bold mb-4">QR Code</h3>
              <p className="text-xs text-text-secondary mb-3">Print this on flyers, truck signage, or business cards.</p>
              <div className="flex flex-col items-center gap-4">
                <QRCode value={portalUrl} size={220} />
                <div className="flex gap-2">
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(portalUrl)}&format=png&margin=16`}
                    download={`${tenantSlug}-qr-code.png`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-brand-dark text-white hover:bg-brand-dark/90 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download PNG
                  </a>
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(portalUrl)}&format=svg&margin=16`}
                    download={`${tenantSlug}-qr-code.svg`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-text-primary hover:border-brand-cyan hover:text-brand-cyan transition-all"
                  >
                    Download SVG
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="font-bold mb-4">Portal Preview</h3>
              <p className="text-xs text-text-secondary mb-3">How applicants see your recruitment landing page.</p>
              <div className="border border-border rounded-lg overflow-hidden bg-surface-light">
                <div className="bg-brand-dark text-white px-4 py-3 text-center">
                  <div className="text-xs opacity-60 mb-1">🔒 {domain}</div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {activeLogo ? (
                      <img src={activeLogo} alt="" className="h-6 w-auto object-contain" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-brand-cyan/30 flex items-center justify-center text-white text-sm font-bold">
                        {activeCompanyName.charAt(0)}
                      </div>
                    )}
                    <h4 className="font-bold text-base">{activeCompanyName}</h4>
                  </div>
                  <p className="text-xs opacity-70 mt-0.5">Apply to become a delivery driver</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-8 bg-white rounded border border-border flex items-center px-3 text-xs text-text-muted">Full Name</div>
                  <div className="h-8 bg-white rounded border border-border flex items-center px-3 text-xs text-text-muted">Email Address</div>
                  <div className="h-8 bg-white rounded border border-border flex items-center px-3 text-xs text-text-muted">Phone Number</div>
                  <div className="h-8 bg-white rounded border border-border flex items-center px-3 text-xs text-text-muted">City / Region</div>
                  <div className="h-8 bg-brand-cyan rounded flex items-center justify-center text-sm font-bold text-brand-dark">
                    Start Application →
                  </div>
                </div>
                <div className="px-4 py-2 text-center text-[10px] text-text-muted border-t border-border">
                  Powered by DFRNT
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Tab: Ad Platforms ──── */}
      {activeTab === 'platforms' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Post your job to these platforms. Each link opens the platform's job posting page.
            {country === 'NZ' ? ' Showing NZ + global platforms.' : ' Showing US + global platforms.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlatforms.map(platform => {
              const utmUrl = buildUTM(portalUrl, platform.name);
              return (
                <div key={platform.name} className="bg-white border border-border rounded-lg p-5 hover:border-brand-cyan/50 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">{platform.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm">{platform.name}</h4>
                      <span className="text-xs text-text-secondary">{platform.cost}</span>
                    </div>
                    {platform.countries.length === 2 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">Global</span>
                    )}
                    {platform.countries.length === 1 && platform.countries[0] === 'NZ' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">🇳🇿 NZ</span>
                    )}
                    {platform.countries.length === 1 && platform.countries[0] === 'US' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">🇺🇸 US</span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mb-4 leading-relaxed">{platform.tips}</p>
                  <div className="space-y-2">
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-brand-dark text-white hover:bg-brand-dark/90 transition-all"
                    >
                      Post a Job →
                    </a>
                    <div className="flex gap-2">
                      <CopyButton text={utmUrl} label="Copy Apply URL" />
                      <CopyButton text={renderedTemplate} label="Copy Job Desc" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ──── Tab: Job Description Template ──── */}
      {activeTab === 'template' && (
        <div className="space-y-4">
          {/* Merge Fields */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="font-bold mb-3">Merge Fields</h3>
            <p className="text-xs text-text-secondary mb-4">Set your values — they'll be replaced in the template below.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {MERGE_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="text-xs text-text-secondary block mb-1">
                    {field.label} <code className="text-[10px] text-brand-cyan">{field.key}</code>
                  </label>
                  <input
                    type="text"
                    value={fieldValues[field.key] || ''}
                    onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Editor + Preview side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">
                  Template Editor
                  <span className="ml-2 text-xs font-normal text-text-secondary">
                    ({country === 'NZ' ? 'New Zealand' : 'United States'} variant)
                  </span>
                </h3>
                <button
                  onClick={() => setCustomTemplate('')}
                  className="text-xs text-text-muted hover:text-brand-cyan transition-colors"
                >
                  Reset to default
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {MERGE_FIELDS.map(field => (
                  <button
                    key={field.key}
                    onClick={() => {
                      if (textareaRef.current) {
                        const ta = textareaRef.current;
                        const start = ta.selectionStart;
                        const end = ta.selectionEnd;
                        const current = customTemplate || baseTemplate;
                        const newVal = current.slice(0, start) + field.key + current.slice(end);
                        setCustomTemplate(newVal);
                        setTimeout(() => {
                          ta.focus();
                          ta.selectionStart = ta.selectionEnd = start + field.key.length;
                        }, 0);
                      }
                    }}
                    className="px-2 py-1 rounded text-[11px] font-mono bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 hover:bg-brand-cyan/20 transition-all"
                  >
                    {field.key}
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={customTemplate || baseTemplate}
                onChange={e => setCustomTemplate(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono leading-relaxed resize-none"
              />
            </div>

            <div className="bg-white border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">Preview (Copy-Ready)</h3>
                <CopyButton text={renderedTemplate} label="Copy to Clipboard" />
              </div>
              <div className="bg-surface-light rounded-lg p-4 border border-border">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-text-primary">{renderedTemplate}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Tab: Tracking ──── */}
      {activeTab === 'tracking' && (
        <div className="space-y-4">
          {/* UTM Generator */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="font-bold mb-3">UTM Link Generator</h3>
            <p className="text-xs text-text-secondary mb-4">
              Each platform link automatically includes UTM parameters for tracking. Copy the tracked URL for any platform:
            </p>
            <div className="space-y-2">
              {filteredPlatforms.map(platform => {
                const utmUrl = buildUTM(portalUrl, platform.name);
                return (
                  <div key={platform.name} className="flex items-center gap-3 bg-surface-light rounded-lg p-3 border border-border">
                    <span className="text-lg">{platform.icon}</span>
                    <span className="text-sm font-medium w-40 flex-shrink-0">{platform.name}</span>
                    <code className="flex-1 text-xs text-text-secondary font-mono truncate">{utmUrl}</code>
                    <CopyButton text={utmUrl} label="Copy" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Analytics */}
          <div className="bg-white border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold">Applications by Source</h3>
                <p className="text-xs text-text-secondary mt-0.5">Last 90 days • from CourierApplicant.source field</p>
              </div>
              <span className="text-2xl font-bold text-brand-dark">
                {MOCK_SOURCE_STATS.reduce((sum, s) => sum + s.count, 0)}
                <span className="text-sm font-normal text-text-secondary ml-1">total</span>
              </span>
            </div>
            <div className="space-y-3">
              {MOCK_SOURCE_STATS.map(stat => (
                <div key={stat.source} className="flex items-center gap-3">
                  <span className="text-sm w-44 flex-shrink-0 text-text-primary">{stat.source}</span>
                  <div className="flex-1 h-6 bg-surface-light rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-brand-cyan rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(stat.percentage, 8)}%` }}
                    >
                      <span className="text-[10px] font-bold text-brand-dark">{stat.count}</span>
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary w-10 text-right">{stat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
