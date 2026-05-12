import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useCouriers } from '@/hooks/useCouriers';
import StatusBadge from '@/components/common/StatusBadge';
import ComplianceBadge from '@/components/common/ComplianceBadge';
import { complianceProfileService } from '@/services/np_complianceProfileService';
import { driverApprovalService } from '@/services/np_driverApprovalService';
import { fleetService } from '@/services/np_fleetService';

interface Props {
  onSelectCourier: (id: number) => void;
}

export default function FleetOverview({ onSelectCourier }: Props) {
  const navigate = useNavigate();
  const {
    couriers, search, setSearch,
    statusFilter, setStatusFilter,
    locationFilter, setLocationFilter,
    vehicleFilter, setVehicleFilter,
    active, inactive, alerts,
  } = useCouriers();

  const [qualificationFilter, setQualificationFilter] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [roleModal, setRoleModal] = useState<number | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  const allProfiles = complianceProfileService.getAll().filter(p => p.active);
  const driverStatuses = complianceProfileService.getDriverStatuses();
  const allWithApproval = driverApprovalService.getAllCouriersWithApproval();
  const depots = fleetService.getDepots();

  const getApprovalStatus = (courierId: number) => {
    return allWithApproval.find(c => c.id === courierId)?.tenantApprovalStatus;
  };

  const getDriverProfiles = (courierId: number) => {
    const ds = driverStatuses.find(d => d.courierId === courierId);
    if (!ds) return [];
    return ds.profiles;
  };

  const hasEligibleProfile = (courierId: number) => {
    const ds = driverStatuses.find(d => d.courierId === courierId);
    if (!ds) return false;
    const approval = getApprovalStatus(courierId);
    if (approval === 'pending_approval' || approval === 'approved') return false;
    return ds.profiles.some(p => p.isEligible);
  };

  const getProfilesForModal = (courierId: number) => {
    const ds = driverStatuses.find(d => d.courierId === courierId);
    return allProfiles.map(profile => {
      const driverProfile = ds?.profiles.find(p => p.profileId === profile.id);
      return {
        profile,
        isEligible: driverProfile?.isEligible ?? false,
        completionPct: driverProfile?.completionPct ?? 0,
        requirements: driverProfile?.requirements ?? [],
      };
    });
  };

  const handleRequestApproval = () => {
    if (roleModal && selectedProfileId) {
      driverApprovalService.flagForApproval(roleModal, selectedProfileId);
      const c = couriers.find(c => c.id === roleModal);
      const profile = allProfiles.find(p => p.id === selectedProfileId);
      setToast(`${c?.firstName} ${c?.surName} submitted for "${profile?.name}" approval`);
      setTimeout(() => setToast(null), 3000);
      setRoleModal(null);
      setSelectedProfileId(null);
    }
  };

  // Map courier locations to nearest depot for filtering
  const getDepotForCourier = (location: string): string => {
    // Match depot name if location contains it
    const depot = depots.find(d => location.toLowerCase().includes(d.name.toLowerCase()));
    return depot?.name || location;
  };

  // Apply qualification filter
  const filteredCouriers = useMemo(() => {
    if (!qualificationFilter) return couriers;
    return couriers.filter(c => {
      const profiles = getDriverProfiles(c.id);
      if (qualificationFilter === 'eligible') return profiles.some(p => p.isEligible);
      if (qualificationFilter === 'no-profile') return profiles.length === 0;
      // Filter by specific profile ID
      const profileId = parseInt(qualificationFilter);
      if (!isNaN(profileId)) {
        return profiles.some(p => p.profileId === profileId && p.isEligible);
      }
      return true;
    });
  }, [couriers, qualificationFilter, driverStatuses]);

  const masters = filteredCouriers.filter(c => c.type === 'Master');

  const handleSelect = (id: number) => {
    onSelectCourier(id);
    navigate(`/courier/${id}`);
  };

  const renderApprovalCell = (courierId: number) => {
    const status = getApprovalStatus(courierId);
    if (status === 'pending_approval') return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Pending</span>;
    if (status === 'approved') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Approved</span>;
    if (status === 'rejected') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Rejected</span>;
    if (hasEligibleProfile(courierId)) {
      return (
        <button
          onClick={() => { setRoleModal(courierId); setSelectedProfileId(null); }}
          className="text-xs px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 font-medium transition-colors whitespace-nowrap"
        >
          Request Role Approval
        </button>
      );
    }
    return <span className="text-xs text-gray-400">—</span>;
  };

  const renderQualifications = (courierId: number) => {
    const profiles = getDriverProfiles(courierId);
    if (profiles.length === 0) return <span className="text-xs text-gray-400">No profiles</span>;

    return (
      <div className="flex flex-wrap gap-1">
        {profiles.map(p => (
          <span
            key={p.profileId}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              p.isEligible
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
            title={`${p.profileName}: ${p.completionPct}% complete`}
          >
            {p.isEligible ? '✓ ' : ''}{p.profileName}
            {!p.isEligible && <span className="ml-0.5 opacity-60">{p.completionPct}%</span>}
          </span>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Driver Management</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate('/fleet/add?mode=quick')} className="bg-blue-600 text-white border-none font-medium px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors">
            + Add Agent Manually
          </button>
          <button onClick={() => navigate('/fleet/add')} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow">
            + Full Recruitment
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search drivers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="min-w-[200px]"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-auto min-w-[130px]">
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="w-auto min-w-[140px]">
          <option>All Depots</option>
          {depots.map(d => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} className="w-auto min-w-[130px]">
          <option>All Vehicles</option>
          <option>Car</option>
          <option>Van</option>
          <option>Truck</option>
          <option>Motorcycle</option>
        </select>
        <select value={qualificationFilter} onChange={e => setQualificationFilter(e.target.value)} className="w-auto min-w-[160px]">
          <option value="">All Qualifications</option>
          {allProfiles.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value="eligible">Any Eligible Profile</option>
          <option value="no-profile">No Profiles</option>
        </select>
        <span className="ml-auto text-[13px] text-text-primary">
          {active} Active · {inactive} Inactive · {alerts} Compliance Alerts
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-lg overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Code</th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Name</th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Phone</th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Vehicle</th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Depot</th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Status</th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Compliance</th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Qualifications</th>
              <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Role Approval</th>
            </tr>
          </thead>
          <tbody>
            {masters.flatMap(m => {
              const subs = filteredCouriers.filter(c => c.master === m.id);
              const mDepot = getDepotForCourier(m.location);
              return [
                <tr key={m.id} onClick={() => handleSelect(m.id)} className="hover:bg-surface-cream cursor-pointer">
                  <td className="px-3 py-2.5 text-sm border-b border-border font-bold whitespace-nowrap">{m.code}</td>
                  <td className="px-3 py-2.5 text-sm border-b border-border">
                    {m.firstName} {m.surName}{' '}
                    <span className="text-brand-cyan text-[11px] ml-1">MASTER</span>
                  </td>
                  <td className="px-3 py-2.5 text-sm border-b border-border whitespace-nowrap">{m.phone}</td>
                  <td className="px-3 py-2.5 text-sm border-b border-border">{m.vehicle}</td>
                  <td className="px-3 py-2.5 text-sm border-b border-border">{mDepot}</td>
                  <td className="px-3 py-2.5 text-sm border-b border-border"><StatusBadge status={m.status} /></td>
                  <td className="px-3 py-2.5 text-sm border-b border-border"><ComplianceBadge status={m.compliance} /></td>
                  <td className="px-3 py-2.5 border-b border-border">{renderQualifications(m.id)}</td>
                  <td className="px-3 py-2.5 text-sm border-b border-border" onClick={e => e.stopPropagation()}>
                    {renderApprovalCell(m.id)}
                  </td>
                </tr>,
                ...subs.map(s => {
                  const sDepot = getDepotForCourier(s.location);
                  return (
                    <tr key={s.id} onClick={() => handleSelect(s.id)} className="hover:bg-surface-cream cursor-pointer">
                      <td className="px-3 py-2.5 text-sm border-b border-border pl-9 whitespace-nowrap">↳ {s.code}</td>
                      <td className="px-3 py-2.5 text-sm border-b border-border">{s.firstName} {s.surName}</td>
                      <td className="px-3 py-2.5 text-sm border-b border-border whitespace-nowrap">{s.phone}</td>
                      <td className="px-3 py-2.5 text-sm border-b border-border">{s.vehicle}</td>
                      <td className="px-3 py-2.5 text-sm border-b border-border">{sDepot}</td>
                      <td className="px-3 py-2.5 text-sm border-b border-border"><StatusBadge status={s.status} /></td>
                      <td className="px-3 py-2.5 text-sm border-b border-border"><ComplianceBadge status={s.compliance} /></td>
                      <td className="px-3 py-2.5 border-b border-border">{renderQualifications(s.id)}</td>
                      <td className="px-3 py-2.5 text-sm border-b border-border" onClick={e => e.stopPropagation()}>
                        {renderApprovalCell(s.id)}
                      </td>
                    </tr>
                  );
                }),
              ];
            })}
            {masters.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-text-secondary">
                  No drivers match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Request Role Approval Modal */}
      {roleModal && (() => {
        const courier = couriers.find(c => c.id === roleModal);
        const courierProfiles = getProfilesForModal(roleModal);
        const selectedInfo = courierProfiles.find(cp => cp.profile.id === selectedProfileId);

        return (
          <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setRoleModal(null); }}>
            <div className="bg-white rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
              <div className="p-5 border-b border-border">
                <h3 className="text-lg font-bold">Request Role Approval</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Submit <strong>{courier?.firstName} {courier?.surName}</strong> for tenant approval on a specific role
                </p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-text-secondary uppercase tracking-wide block mb-2">Select Role Profile</label>
                  <div className="space-y-2">
                    {courierProfiles.map(({ profile, isEligible, completionPct }) => (
                      <button
                        key={profile.id}
                        onClick={() => isEligible && setSelectedProfileId(profile.id)}
                        disabled={!isEligible}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selectedProfileId === profile.id
                            ? 'border-purple-500 bg-purple-50'
                            : isEligible
                              ? 'border-border hover:border-purple-300'
                              : 'border-border opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{profile.name}</span>
                          <div className="flex items-center gap-2">
                            {isEligible ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">✓ Eligible</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">{completionPct}% complete</span>
                            )}
                          </div>
                        </div>
                        {profile.description && (
                          <div className="text-xs text-text-secondary mt-0.5">{profile.description}</div>
                        )}
                        {profile.clientNames && profile.clientNames.length > 0 && (
                          <div className="text-xs text-text-secondary mt-0.5">Clients: {profile.clientNames.join(', ')}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedInfo && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-purple-50 px-4 py-2 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                        {selectedInfo.profile.name} — Requirements
                      </span>
                      <span className="text-xs text-purple-600 font-bold">{selectedInfo.completionPct}%</span>
                    </div>
                    <div className="divide-y divide-border">
                      {selectedInfo.requirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2">
                          <span className="text-sm">
                            {req.status === 'Complete' ? '✅' : req.status === 'Expired' ? '⚠️' : '⬜'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-text-primary">{req.documentTypeName}</div>
                            <div className="text-[10px] text-text-secondary flex items-center gap-2">
                              <span className={req.purpose === 'Training' ? 'text-purple-500' : 'text-blue-500'}>
                                {req.purpose === 'Training' ? '🎓 Training' : '📋 Compliance'}
                              </span>
                              {req.completedDate && <span>Completed {new Date(req.completedDate).toLocaleDateString()}</span>}
                              {req.expiryDate && <span>Expires {new Date(req.expiryDate).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex justify-end gap-3">
                <button onClick={() => setRoleModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button
                  onClick={handleRequestApproval}
                  disabled={!selectedProfileId}
                  className="bg-purple-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Submit for Tenant Approval
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-brand-dark text-white px-4 py-3 rounded-lg shadow-lg text-sm z-[300]">
          ✓ {toast}
        </div>
      )}
    </>
  );
}
