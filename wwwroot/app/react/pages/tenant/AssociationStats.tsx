import React from 'react';
import { StatCard } from '@/components/tenant/StatCard';
import { AssociationBadge } from '@/components/common/AssociationBadge';

const assocData = [
  {
    association: 'ECA' as const,
    totalCarriers: 487,
    onboarded: 89,
    activeNps: 14,
    topStates: ['IL', 'TX', 'GA', 'AZ', 'CO'],
    onboardingPipeline: { prospect: 32, inProgress: 12, completed: 89 },
  },
  {
    association: 'CLDA' as const,
    totalCarriers: 334,
    onboarded: 58,
    activeNps: 9,
    topStates: ['TX', 'IL', 'AZ', 'FL'],
    onboardingPipeline: { prospect: 28, inProgress: 8, completed: 58 },
  },
];

export function AssociationStats() {
  const totalCarriers = assocData.reduce((s, a) => s + a.totalCarriers, 0);
  const totalOnboarded = assocData.reduce((s, a) => s + a.onboarded, 0);
  const totalNps = assocData.reduce((s, a) => s + a.activeNps, 0);

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total in Registry" value={totalCarriers} color="cyan" icon="🌐" />
        <StatCard label="Onboarded" value={totalOnboarded} color="green" icon="✅" />
        <StatCard label="Active NPs" value={totalNps} color="purple" />
        <StatCard label="Conversion Rate" value={`${((totalOnboarded / totalCarriers) * 100).toFixed(1)}%`} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Association breakdown cards */}
        {assocData.map((assoc) => (
          <div key={assoc.association} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <AssociationBadge association={assoc.association} />
              <span className="text-lg font-bold text-text-primary">{assoc.association === 'ECA' ? 'Express Carriers Association' : 'Customised Logistics & Delivery Association'}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-cyan">{assoc.totalCarriers}</div>
                <div className="text-xs text-text-muted">Total Carriers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{assoc.onboarded}</div>
                <div className="text-xs text-text-muted">Onboarded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-purple">{assoc.activeNps}</div>
                <div className="text-xs text-text-muted">Active NPs</div>
              </div>
            </div>

            {/* Onboarding Pipeline Funnel */}
            <div className="mb-4">
              <div className="text-sm font-bold text-text-secondary mb-3">Onboarding Pipeline</div>
              <div className="space-y-2">
                {[
                  { label: 'Prospects', value: assoc.onboardingPipeline.prospect, color: 'bg-badge-blue-bg', textColor: 'text-badge-blue-text' },
                  { label: 'In Progress', value: assoc.onboardingPipeline.inProgress, color: 'bg-warning-bg', textColor: 'text-warning' },
                  { label: 'Completed', value: assoc.onboardingPipeline.completed, color: 'bg-success-bg', textColor: 'text-success' },
                ].map((stage) => {
                  const maxVal = Math.max(assoc.onboardingPipeline.prospect, assoc.onboardingPipeline.completed);
                  const pct = (stage.value / maxVal) * 100;
                  return (
                    <div key={stage.label} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-text-muted">{stage.label}</div>
                      <div className="flex-1 h-6 bg-surface-light rounded-full overflow-hidden">
                        <div
                          className={`h-full ${stage.color} rounded-full flex items-center px-2`}
                          style={{ width: `${Math.max(pct, 10)}%` }}
                        >
                          <span className={`text-xs font-bold ${stage.textColor}`}>{stage.value}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coverage */}
            <div>
              <div className="text-sm font-bold text-text-secondary mb-2">Top Coverage Areas</div>
              <div className="flex flex-wrap gap-1.5">
                {assoc.topStates.map((state) => (
                  <span key={state} className="px-2.5 py-0.5 text-xs font-normal rounded-full bg-badge-blue-bg text-badge-blue-text">
                    {state}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coverage Map Placeholder */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">Coverage Map</h2>
        <div className="h-64 bg-surface-light rounded-lg flex items-center justify-center text-text-muted">
          <div className="text-center">
            <div className="text-4xl mb-3">🗺️</div>
            <div className="text-lg font-bold text-text-primary mb-1">Interactive Coverage Map</div>
            <div className="text-sm">Carrier density heatmap by region — coming soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}
