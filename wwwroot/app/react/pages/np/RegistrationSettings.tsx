import { useState, useEffect } from 'react';
import { registrationSiteService, type RegistrationSite } from '@/services/np_registrationSiteService';

// ─── Toggle Switch ───
function ToggleSwitch({ checked, onChange, disabled, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${dims} shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40 disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-[#3bc7f4]' : 'bg-gray-300'}`}
    >
      <span className={`pointer-events-none inline-block ${knob} transform rounded-full bg-white shadow transition duration-200 ${checked ? translate : 'translate-x-0'}`} />
    </button>
  );
}

// ─── Main Component ───
export default function RegistrationSettings() {
  const [sites, setSites] = useState<RegistrationSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    registrationSiteService.getSites()
      .then(data => { if (!cancelled) setSites(data); })
      .catch(() => { if (!cancelled) setError('Could not load sites.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleSite = async (site: RegistrationSite) => {
    const next = !site.applicantEnabled;
    // Optimistic update.
    setSites(prev => prev.map(s => s.id === site.id ? { ...s, applicantEnabled: next } : s));
    setBusyIds(prev => new Set(prev).add(site.id));
    setError(null);
    try {
      await registrationSiteService.setEnabled(site.id, next);
    } catch {
      // Revert on failure.
      setSites(prev => prev.map(s => s.id === site.id ? { ...s, applicantEnabled: site.applicantEnabled } : s));
      setError(`Could not update ${site.name}.`);
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(site.id); return n; });
    }
  };

  const enabledCount = sites.filter(s => s.applicantEnabled).length;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-[#0d0c2c]">Registration Settings</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <h3 className="text-base font-bold text-[#0d0c2c] mb-3 flex items-center gap-2">
          Active Locations
          <span className="text-xs font-normal text-text-secondary bg-[#f4f2f1] px-2 py-0.5 rounded-full">{enabledCount}</span>
        </h3>
        <p className="text-xs text-text-secondary mb-4">Enable or disable applicant registration per location.</p>

        {loading ? (
          <div className="text-sm text-text-secondary py-6 text-center">Loading sites…</div>
        ) : sites.length === 0 ? (
          <div className="text-sm text-text-secondary py-6 text-center">No sites found.</div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {sites.map(site => (
              <div key={site.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#f4f2f1]/50 transition-colors">
                <span className={`text-sm font-medium ${site.applicantEnabled ? 'text-[#0d0c2c]' : 'text-text-secondary'}`}>{site.name}</span>
                <ToggleSwitch
                  checked={site.applicantEnabled}
                  onChange={() => toggleSite(site)}
                  disabled={busyIds.has(site.id)}
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
