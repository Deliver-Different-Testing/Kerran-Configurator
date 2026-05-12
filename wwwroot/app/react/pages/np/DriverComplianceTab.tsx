import { useState, useEffect } from 'react';
import { complianceProfileService } from '@/services/np_complianceProfileService';
import type { DriverComplianceStatus, ProfileComplianceStatus, RequirementStatus } from '@/types';

const STATUS_CONFIG: Record<RequirementStatus['status'], { icon: string; color: string; bg: string }> = {
  Complete: { icon: '✅', color: 'text-green-600', bg: 'bg-green-50' },
  Expired: { icon: '❌', color: 'text-red-600', bg: 'bg-red-50' },
  Expiring: { icon: '⚠️', color: 'text-amber-600', bg: 'bg-amber-50' },
  Missing: { icon: '⬜', color: 'text-gray-400', bg: 'bg-gray-50' },
};

function ProfileSection({ profile }: { profile: ProfileComplianceStatus }) {
  const mandatoryReqs = profile.requirements.filter(r => r.mandatory);
  const completeMandatory = mandatoryReqs.filter(r => r.status === 'Complete').length;

  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-text-primary">{profile.profileName}</h4>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
            profile.isEligible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {profile.isEligible ? '✓ Eligible' : '✗ Not Eligible'}
          </span>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${profile.isEligible ? 'bg-green-500' : 'bg-[#3bc7f4]'}`}
              style={{ width: `${profile.completionPct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-text-secondary">{profile.completionPct}%</span>
        </div>
        <p className="text-[11px] text-text-muted mt-1">{completeMandatory}/{mandatoryReqs.length} mandatory requirements met</p>
      </div>
      <div className="divide-y divide-border">
        {profile.requirements.map(req => {
          const cfg = STATUS_CONFIG[req.status];
          return (
            <div key={req.requirementId} className={`flex items-center gap-3 px-4 py-2.5 ${cfg.bg}`}>
              <span>{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-primary">{req.documentTypeName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${req.purpose === 'Training' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    {req.purpose}
                  </span>
                  {req.mandatory && (
                    <span className="text-[10px] text-red-400 font-bold">Required</span>
                  )}
                </div>
                {req.expiryDate && (
                  <span className={`text-[10px] ${cfg.color}`}>
                    {req.status === 'Expired' ? 'Expired' : 'Expires'}: {new Date(req.expiryDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              {(req.status === 'Missing' || req.status === 'Expired') && (
                <button className="text-[11px] px-2 py-1 rounded bg-[#3bc7f4]/10 text-[#3bc7f4] hover:bg-[#3bc7f4]/20 font-medium shrink-0">
                  Upload
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DriverComplianceTab({ courierId }: { courierId: number }) {
  const [status, setStatus] = useState<DriverComplianceStatus | null>(null);

  useEffect(() => {
    const s = complianceProfileService.getDriverStatus(courierId);
    setStatus(s || null);
  }, [courierId]);

  if (!status) {
    return (
      <div className="bg-white border border-border rounded-lg p-8 text-center">
        <p className="text-text-secondary text-sm">No compliance profile data available for this driver.</p>
      </div>
    );
  }

  const eligibleProfiles = status.profiles.filter(p => p.isEligible).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-text-primary">{status.profiles.length}</div>
          <div className="text-xs text-text-secondary">Assigned Profiles</div>
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-green-600">{eligibleProfiles}</div>
          <div className="text-xs text-text-secondary">Eligible</div>
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-[#3bc7f4]">{status.overallCompletionPct}%</div>
          <div className="text-xs text-text-secondary">Overall Completion</div>
        </div>
      </div>

      {/* Profile sections */}
      {status.profiles.map(p => (
        <ProfileSection key={p.profileId} profile={p} />
      ))}
    </div>
  );
}
