import { useState } from 'react';

// ─── Mock Data ───

interface Location {
  id: number;
  name: string;
  country: string;
  applicantEnabled: boolean;
}

const initialLocations: Location[] = [
  { id: 1, name: 'Auckland', country: 'NZ', applicantEnabled: true },
  { id: 2, name: 'Wellington', country: 'NZ', applicantEnabled: true },
  { id: 3, name: 'Christchurch', country: 'NZ', applicantEnabled: false },
  { id: 4, name: 'Dallas', country: 'US', applicantEnabled: true },
  { id: 5, name: 'Chicago', country: 'US', applicantEnabled: false },
  { id: 6, name: 'Miami', country: 'US', applicantEnabled: true },
];

// ─── Toggle Switch ───
function ToggleSwitch({ checked, onChange, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${dims} shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40 ${checked ? 'bg-[#3bc7f4]' : 'bg-gray-300'}`}
    >
      <span className={`pointer-events-none inline-block ${knob} transform rounded-full bg-white shadow transition duration-200 ${checked ? translate : 'translate-x-0'}`} />
    </button>
  );
}

// ─── Main Component ───
export default function RegistrationSettings() {
  const [locations, setLocations] = useState(initialLocations);

  const toggleLocation = (id: number) => {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, applicantEnabled: !l.applicantEnabled } : l));
  };

  const countriesGrouped = locations.reduce<Record<string, Location[]>>((acc, l) => {
    (acc[l.country] ||= []).push(l);
    return acc;
  }, {});

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-[#0d0c2c]">Registration Settings</h2>
      </div>

      {/* ═══ Active Locations ═══ */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <h3 className="text-base font-bold text-[#0d0c2c] mb-3 flex items-center gap-2">
          Active Locations
          <span className="text-xs font-normal text-text-secondary bg-[#f4f2f1] px-2 py-0.5 rounded-full">{locations.filter(l => l.applicantEnabled).length}</span>
        </h3>
        <p className="text-xs text-text-secondary mb-4">Enable or disable applicant registration per location.</p>
        {Object.entries(countriesGrouped).map(([country, locs]) => (
          <div key={country} className="mb-3 last:mb-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">{country === 'NZ' ? '🇳🇿 New Zealand' : '🇺🇸 United States'}</div>
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {locs.map(loc => (
                <div key={loc.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#f4f2f1]/50 transition-colors">
                  <span className={`text-sm font-medium ${loc.applicantEnabled ? 'text-[#0d0c2c]' : 'text-text-secondary'}`}>{loc.name}</span>
                  <ToggleSwitch checked={loc.applicantEnabled} onChange={() => toggleLocation(loc.id)} size="sm" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
