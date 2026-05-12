import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FormField from '@/components/common/FormField';
import CoverageTag from '@/components/common/CoverageTag';
import TierBadge from '@/components/common/TierBadge';
import { settingsService } from '@/services/np_settingsService';
import { complianceProfileService } from '@/services/np_complianceProfileService';

// ─── DF Admin Feature Toggles ───
interface FeatureToggle {
  key: string;
  label: string;
  description: string;
}

const FEATURE_TOGGLES: FeatureToggle[] = [
  { key: 'CourierComplianceEnabled', label: 'Courier Compliance', description: 'Document verification, expiry tracking, and compliance dashboards' },
  { key: 'CourierRecruitmentEnabled', label: 'Courier Recruitment', description: 'Applicant pipeline, recruitment advertising, and onboarding' },
  { key: 'CourierPortalEnabled', label: 'Courier Portal', description: 'Self-service portal for couriers to manage documents and availability' },
  { key: 'MultiClientEnabled', label: 'Multi-Client', description: 'Manage deliveries across multiple client accounts' },
  { key: 'AutoDispatchEnabled', label: 'Auto Dispatch', description: 'Automated job assignment and route optimization' },
  { key: 'ReportsEnabled', label: 'Reports', description: 'Analytics dashboards and exportable reports' },
  { key: 'SettlementEnabled', label: 'Settlement', description: 'Driver payment processing and settlement runs' },
];

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40 ${
        checked ? 'bg-[#3bc7f4]' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── Compliance Automation Settings ───
function ComplianceAutomationSettings() {
  const [autoDeactivate, setAutoDeactivate] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [warningDays, setWarningDays] = useState({ d30: true, d14: true, d7: true });
  const [notifyNp, setNotifyNp] = useState(true);
  const [notifyTenant, setNotifyTenant] = useState(false);

  return (
    <div className="bg-white border border-border rounded-lg p-5 mb-4">
      <h3 className="font-bold mb-1">Compliance Automation</h3>
      <p className="text-xs text-text-secondary mb-4">Configure automatic enforcement actions when courier documents expire.</p>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auto-deactivate couriers when documents expire</p>
            <p className="text-xs text-text-secondary">Couriers with expired required documents will be automatically set to inactive.</p>
          </div>
          <ToggleSwitch checked={autoDeactivate} onChange={setAutoDeactivate} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Require tenant approval before courier reactivation</p>
            <p className="text-xs text-text-secondary">After a courier renews expired documents, tenant must approve before they can be reactivated.</p>
          </div>
          <ToggleSwitch checked={requireApproval} onChange={setRequireApproval} />
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Warning schedule</p>
          <div className="flex gap-4">
            {([['d30', '30 days before'], ['d14', '14 days before'], ['d7', '7 days before']] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={warningDays[key]}
                  onChange={(e) => setWarningDays(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="rounded border-border text-brand-cyan focus:ring-brand-cyan/40"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Notify network partner on warnings</p>
            <p className="text-xs text-text-secondary">Send email/in-app notification to the NP when courier documents are approaching expiry.</p>
          </div>
          <ToggleSwitch checked={notifyNp} onChange={setNotifyNp} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Notify tenant on warnings</p>
            <p className="text-xs text-text-secondary">Send notifications to the tenant when NP courier documents are approaching expiry.</p>
          </div>
          <ToggleSwitch checked={notifyTenant} onChange={setNotifyTenant} />
        </div>
      </div>
    </div>
  );
}

function TenantRecruitmentViewSetting() {
  const config = complianceProfileService.getRecruitmentConfig();
  const [mode, setMode] = useState<'full_pipeline' | 'ready_for_review'>(config.recruitmentViewMode);

  const handleChange = (newMode: 'full_pipeline' | 'ready_for_review') => {
    setMode(newMode);
    complianceProfileService.setRecruitmentConfig({ ...config, recruitmentViewMode: newMode });
  };

  return (
    <div className="bg-white border border-border rounded-lg mb-4 overflow-hidden">
      <div className="px-5 py-4 border-b border-border" style={{ backgroundColor: '#0d0c2c' }}>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#3bc7f4] text-[#0d0c2c]">
            DF Admin
          </span>
          <h3 className="font-bold text-white">Tenant Recruitment View</h3>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Control what tenants see in the recruitment pipeline. Medical tenants typically use "Ready for Review Only".
        </p>
      </div>
      <div className="p-5 space-y-3">
        <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-[#f4f2f1]/50 transition-colors" style={{ borderColor: mode === 'full_pipeline' ? '#3bc7f4' : undefined }}>
          <input type="radio" name="recruitmentViewMode" checked={mode === 'full_pipeline'} onChange={() => handleChange('full_pipeline')} className="text-[#3bc7f4]" />
          <div>
            <p className="text-sm font-medium">Full Pipeline</p>
            <p className="text-xs text-text-secondary">Tenant sees all recruitment stages and applicants</p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-[#f4f2f1]/50 transition-colors" style={{ borderColor: mode === 'ready_for_review' ? '#3bc7f4' : undefined }}>
          <input type="radio" name="recruitmentViewMode" checked={mode === 'ready_for_review'} onChange={() => handleChange('ready_for_review')} className="text-[#3bc7f4]" />
          <div>
            <p className="text-sm font-medium">Ready for Review Only</p>
            <p className="text-xs text-text-secondary">Tenant only sees applicants who have completed all compliance requirements</p>
          </div>
        </label>
      </div>
    </div>
  );
}

interface Props {
  onUpgrade: () => void;
  isDfAdmin?: boolean;
}

export default function Settings({ onUpgrade, isDfAdmin = false }: Props) {
  const settings = settingsService.getSettings();
  const navigate = useNavigate();
  const [areas, setAreas] = useState(settings.coverageAreas);
  const [newArea, setNewArea] = useState('');
  const [notifications, setNotifications] = useState(settings.notifications);
  const [featureToggles, setFeatureToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURE_TOGGLES.map(f => [f.key, true]))
  );
  const handleToggle = useCallback((key: string, val: boolean) => {
    setFeatureToggles(prev => ({ ...prev, [key]: val }));
  }, []);

  const addArea = () => {
    if (newArea.trim() && !areas.includes(newArea.trim())) {
      setAreas([...areas, newArea.trim()]);
      setNewArea('');
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-5">Settings</h2>

      {/* DF Admin Feature Configuration — only visible to DF Admin */}
      {isDfAdmin && (
        <div className="bg-white border border-border rounded-lg mb-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-border" style={{ backgroundColor: '#0d0c2c' }}>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#3bc7f4] text-[#0d0c2c]">
                DF Admin
              </span>
              <h3 className="font-bold text-white">Feature Configuration</h3>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Enable or disable platform features for this tenant. Changes take effect immediately.
            </p>
          </div>
          <div className="divide-y divide-border">
            {FEATURE_TOGGLES.map(feature => (
              <div key={feature.key} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#f4f2f1]/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-text-primary">{feature.label}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{feature.description}</p>
                </div>
                <ToggleSwitch checked={featureToggles[feature.key] ?? true} onChange={(v) => handleToggle(feature.key, v)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tenant Recruitment View — DF Admin only */}
      {isDfAdmin && (
        <TenantRecruitmentViewSetting />
      )}

      {/* Document Settings Quick Link */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold">Manage Courier Compliance Documents</h3>
          <p className="text-xs text-text-secondary mt-0.5">Configure required document types, expiry rules, and templates for courier compliance.</p>
        </div>
        <button
          onClick={() => navigate('/settings/document-types')}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow shrink-0"
        >
          Manage Document Types
        </button>
      </div>

      {/* Registration Settings Quick Link */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold">Registration Settings</h3>
          <p className="text-xs text-text-secondary mt-0.5">Configure active locations, contracts, and portal documentation for applicant registration.</p>
        </div>
        <button
          onClick={() => navigate('/settings/registration')}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow shrink-0"
        >
          Manage Registration
        </button>
      </div>

      {/* Recruitment Advertising Quick Link */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold">Recruitment Advertising</h3>
          <p className="text-xs text-text-secondary mt-0.5">Generate recruitment URLs, QR codes, post to job boards, and track applicant sources.</p>
        </div>
        <button
          onClick={() => navigate('/settings/recruitment-ads')}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow shrink-0"
        >
          Manage Recruitment Ads
        </button>
      </div>

      {/* Openforce Integration */}
      {featureToggles['openforceEnabled'] !== false && (
        <div className="bg-white border border-border rounded-lg p-5 mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold">Openforce Integration</h3>
            <p className="text-xs text-text-secondary mt-0.5">Configure Openforce API credentials, activation codes, and monitor API connectivity.</p>
          </div>
          <button
            onClick={() => navigate('/settings/openforce')}
            className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow shrink-0"
          >
            Manage Openforce
          </button>
        </div>
      )}

      {/* Company Profile */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <h3 className="font-bold mb-3.5">Company Profile</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Company Name" value={settings.name} />
          <FormField label="Company Code" value={settings.code} readonly />
          <FormField label="Address" value={settings.address} full />
          <FormField label="Phone" value={settings.phone} />
          <FormField label="Email" value={settings.email} />
        </div>
        <div className="mt-3">
          <label className="text-xs text-text-secondary uppercase tracking-wide">Company Logo</label>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg bg-brand-cyan flex items-center justify-center text-2xl font-bold text-black">
              PE
            </div>
            <button className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-[13px] hover:border-brand-cyan hover:text-brand-cyan transition-all">
              Upload Logo
            </button>
          </div>
        </div>
      </div>

      {/* Coverage Areas */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <h3 className="font-bold mb-3.5">Coverage Areas</h3>
        <div className="flex flex-wrap gap-1 mb-3">
          {areas.map(a => (
            <CoverageTag key={a} area={a} onRemove={() => setAreas(areas.filter(x => x !== a))} />
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add new area..."
            value={newArea}
            onChange={e => setNewArea(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addArea()}
            className="w-48"
          />
          <button onClick={addArea} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-[13px] hover:shadow-cyan-glow">
            Add
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <h3 className="font-bold mb-3.5">Notification Preferences</h3>
        {Object.entries(notifications).map(([key, val]) => (
          <FormField
            key={key}
            label={key}
            type="checkbox"
            checked={val}
            onChange={(v) => setNotifications({ ...notifications, [key]: v as boolean })}
          />
        ))}
      </div>

      {/* Tier */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <TierBadge />
            <p className="text-text-secondary text-[13px] mt-2">Upgrade to manage deliveries for multiple clients.</p>
          </div>
          <button onClick={onUpgrade} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow">
            Upgrade to Multi Clients →
          </button>
        </div>
      </div>

      {/* Compliance Automation */}
      <ComplianceAutomationSettings />

      <button className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow">
        Save Settings
      </button>
    </>
  );
}
