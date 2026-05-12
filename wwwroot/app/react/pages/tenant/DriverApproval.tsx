import { useState, useEffect, useMemo } from 'react';
import type { Courier } from '@/types';
import { driverApprovalService } from '@/services/np_driverApprovalService';
import { complianceProfileService } from '@/services/np_complianceProfileService';
import { quizService } from '@/services/np_quizService';
import type { ComplianceProfile, DriverComplianceStatus } from '@/types';
import { useRole } from '@/context/RoleContext';

export function DriverApproval() {
  const { role } = useRole();
  const canApprove = role === 'tenant' || role === 'dfadmin';
  const [drivers, setDrivers] = useState<Courier[]>([]);
  const [profiles, setProfiles] = useState<ComplianceProfile[]>([]);
  const [driverStatuses, setDriverStatuses] = useState<DriverComplianceStatus[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Courier | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [toast, setToast] = useState<string | null>(null);

  const reload = () => {
    const all = driverApprovalService.getAllCouriersWithApproval();
    setDrivers(all);
    setProfiles(complianceProfileService.getAll());
    setDriverStatuses(complianceProfileService.getDriverStatuses());
  };

  useEffect(() => { reload(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = useMemo(() => {
    if (tab === 'pending') return drivers.filter(d => d.tenantApprovalStatus === 'pending_approval');
    if (tab === 'approved') return drivers.filter(d => d.tenantApprovalStatus === 'approved');
    return drivers.filter(d => d.tenantApprovalStatus === 'rejected');
  }, [drivers, tab]);

  const pendingCount = drivers.filter(d => d.tenantApprovalStatus === 'pending_approval').length;
  const approvedCount = drivers.filter(d => d.tenantApprovalStatus === 'approved').length;

  const getProfile = (c: Courier) => profiles.find(p => p.id === c.complianceProfileId);
  const getDriverStatus = (c: Courier) => driverStatuses.find(d => d.courierId === c.id);

  // Get unique requirements across all pending drivers' profiles for dynamic columns
  const dynamicColumns = useMemo(() => {
    if (tab !== 'pending') return [];
    const profileIds = new Set(filtered.map(d => d.complianceProfileId).filter(Boolean));
    const reqMap = new Map<string, string>();
    profileIds.forEach(pid => {
      const p = profiles.find(pr => pr.id === pid);
      p?.requirements.forEach(r => {
        if (!reqMap.has(r.documentTypeName)) reqMap.set(r.documentTypeName, r.documentTypeName);
      });
    });
    return Array.from(reqMap.values());
  }, [filtered, profiles, tab]);

  const getReqStatus = (courier: Courier, reqName: string): 'Complete' | 'Missing' | 'Expired' | 'Expiring' | null => {
    const ds = getDriverStatus(courier);
    if (!ds) return null;
    const profileStatus = ds.profiles.find(p => p.profileId === courier.complianceProfileId);
    if (!profileStatus) return null;
    const req = profileStatus.requirements.find(r => r.documentTypeName === reqName);
    return req?.status ?? null;
  };

  const handleApprove = (courier: Courier) => {
    driverApprovalService.approveDriver(courier.id, approveNotes || undefined);
    setApproveNotes('');
    setSelectedDriver(null);
    reload();
    showToast(`${courier.firstName} ${courier.surName} approved`);
  };

  const handleReject = (courier: Courier) => {
    if (!rejectNotes.trim()) return;
    driverApprovalService.rejectDriver(courier.id, rejectNotes);
    setRejectNotes('');
    setRejectModalOpen(false);
    setSelectedDriver(null);
    reload();
    showToast(`${courier.firstName} ${courier.surName} rejected`);
  };

  const statusIcon = (s: string | null) => {
    if (s === 'Complete') return <span className="text-green-600">✅</span>;
    if (s === 'Expired') return <span className="text-red-500">❌</span>;
    if (s === 'Expiring') return <span className="text-amber-500">⚠️</span>;
    if (s === 'Missing') return <span className="text-red-400">❌</span>;
    return <span className="text-gray-300">—</span>;
  };

  const docStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      current: 'bg-green-100 text-green-700',
      expiring: 'bg-amber-100 text-amber-700',
      expired: 'bg-red-100 text-red-700',
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Driver Approval</h2>
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingCount} Pending
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(['pending', 'approved', 'rejected'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedDriver(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              tab === t ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'pending' ? `Pending (${pendingCount})` : t === 'approved' ? `Approved (${approvedCount})` : 'Rejected'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-lg p-12 text-center text-text-secondary">
          No {tab} drivers
        </div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Driver Name</th>
                <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Profile</th>
                {tab === 'pending' && dynamicColumns.map(col => (
                  <th key={col} className="text-center text-xs font-semibold text-text-primary uppercase tracking-wide px-2 py-2.5 border-b border-border whitespace-nowrap" title={col}>
                    {col.length > 15 ? col.slice(0, 13) + '…' : col}
                  </th>
                ))}
                {tab !== 'pending' && <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Date</th>}
                {tab !== 'pending' && <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Notes</th>}
                <th className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const profile = getProfile(d);
                const rowColor = tab === 'approved' ? 'bg-green-50/50' : tab === 'rejected' ? 'bg-red-50/30' : '';
                return (
                  <tr key={d.id} className={`hover:bg-surface-cream cursor-pointer ${rowColor} ${selectedDriver?.id === d.id ? 'bg-brand-cyan/10' : ''}`} onClick={() => setSelectedDriver(d)}>
                    <td className="px-3 py-2.5 text-sm border-b border-border font-medium">{d.firstName} {d.surName}</td>
                    <td className="px-3 py-2.5 text-sm border-b border-border">{profile?.name || '—'}</td>
                    {tab === 'pending' && dynamicColumns.map(col => (
                      <td key={col} className="px-2 py-2.5 text-sm border-b border-border text-center">{statusIcon(getReqStatus(d, col))}</td>
                    ))}
                    {tab !== 'pending' && <td className="px-3 py-2.5 text-sm border-b border-border">{d.tenantApprovalDate ? new Date(d.tenantApprovalDate).toLocaleDateString() : '—'}</td>}
                    {tab !== 'pending' && <td className="px-3 py-2.5 text-sm border-b border-border text-text-secondary">{d.tenantApprovalNotes || '—'}</td>}
                    <td className="px-3 py-2.5 text-sm border-b border-border">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedDriver(d); }} className="text-brand-cyan hover:underline text-sm font-medium">View</button>
                      {tab === 'pending' && canApprove && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleApprove(d); }} className="ml-3 text-green-600 hover:underline text-sm font-medium">Approve</button>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedDriver(d); setRejectModalOpen(true); }} className="ml-3 text-red-500 hover:underline text-sm font-medium">Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selectedDriver && !rejectModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setSelectedDriver(null); }}>
          <div className="bg-white rounded-lg shadow-lg border border-border w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{selectedDriver.firstName} {selectedDriver.surName}</h3>
                <button onClick={() => setSelectedDriver(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>

              {/* Driver Profile */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-text-secondary uppercase mb-1">Vehicle</p>
                  <p className="text-sm font-medium">{selectedDriver.make} {selectedDriver.model} ({selectedDriver.year})</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase mb-1">Vehicle Type</p>
                  <p className="text-sm font-medium">{selectedDriver.vehicle}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase mb-1">Start Date</p>
                  <p className="text-sm font-medium">{selectedDriver.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase mb-1">Experience</p>
                  <p className="text-sm font-medium">{Math.floor((Date.now() - new Date(selectedDriver.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase mb-1">Location</p>
                  <p className="text-sm font-medium">{selectedDriver.location}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase mb-1">Compliance Profile</p>
                  <p className="text-sm font-medium">{getProfile(selectedDriver)?.name || '—'}</p>
                </div>
              </div>

              {/* Documents */}
              <h4 className="text-sm font-bold mb-2 text-text-primary">Documents</h4>
              <div className="border border-border rounded-lg overflow-hidden mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-semibold px-3 py-2 border-b border-border">Document</th>
                      <th className="text-left text-xs font-semibold px-3 py-2 border-b border-border">Uploaded</th>
                      <th className="text-left text-xs font-semibold px-3 py-2 border-b border-border">Expiry</th>
                      <th className="text-left text-xs font-semibold px-3 py-2 border-b border-border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDriver.documents.map((doc, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-sm border-b border-border">{doc.type}</td>
                        <td className="px-3 py-2 text-sm border-b border-border">{doc.uploaded}</td>
                        <td className="px-3 py-2 text-sm border-b border-border">{doc.expiry || '—'}</td>
                        <td className="px-3 py-2 text-sm border-b border-border">{docStatusBadge(doc.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Training */}
              <h4 className="text-sm font-bold mb-2 text-text-primary">Training</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-text-secondary">Initial Training</p>
                  <p className="text-lg font-bold">{selectedDriver.trainingInit} hrs</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-text-secondary">Follow-up Training</p>
                  <p className="text-lg font-bold">{selectedDriver.trainingFollow} hrs</p>
                </div>
              </div>
              {/* Quiz Status for Training Requirements */}
              {(() => {
                const profile = getProfile(selectedDriver);
                if (!profile) return null;
                const trainingReqs = profile.requirements.filter(r => r.purpose === 'Training');
                if (trainingReqs.length === 0) return null;
                return (
                  <div className="mb-6 space-y-1">
                    {trainingReqs.map(req => {
                      const quiz = quizService.getQuizForDocType(req.documentTypeId);
                      if (!quiz) return null;
                      const passed = quizService.hasPassedQuiz(quiz.id, selectedDriver.id);
                      const attempts = quizService.getAttemptCount(quiz.id, selectedDriver.id);
                      const bestScore = quizService.getBestScore(quiz.id, selectedDriver.id);
                      return (
                        <div key={req.id} className="flex items-center gap-2 text-sm">
                          <span>{req.documentTypeName}:</span>
                          {passed ? (
                            <span className="text-green-600">✅ Passed ({bestScore}%, {attempts === 1 ? '1st' : attempts === 2 ? '2nd' : attempts === 3 ? '3rd' : `${attempts}th`} attempt)</span>
                          ) : attempts > 0 ? (
                            <span className="text-red-500">❌ Failed ({bestScore}%, {attempts}/{quiz.maxAttempts || '∞'} attempts)</span>
                          ) : (
                            <span className="text-gray-400">⏳ Not attempted</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Compliance Requirements Status */}
              {(() => {
                const ds = getDriverStatus(selectedDriver);
                const profileStatus = ds?.profiles.find(p => p.profileId === selectedDriver.complianceProfileId);
                if (!profileStatus) return null;
                return (
                  <>
                    <h4 className="text-sm font-bold mb-2 text-text-primary">Compliance Requirements ({profileStatus.completionPct}% complete)</h4>
                    <div className="space-y-1 mb-6">
                      {profileStatus.requirements.map(r => (
                        <div key={r.requirementId} className="flex items-center gap-2 text-sm">
                          {statusIcon(r.status)}
                          <span>{r.documentTypeName}</span>
                          {r.expiryDate && <span className="text-xs text-text-secondary ml-auto">exp: {r.expiryDate}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* Actions — only tenant/dfadmin can approve/reject */}
              {selectedDriver.tenantApprovalStatus === 'pending_approval' && canApprove && (
                <div className="border-t border-border pt-4">
                  <div className="mb-3">
                    <label className="text-xs text-text-secondary block mb-1">Notes (optional)</label>
                    <textarea
                      value={approveNotes}
                      onChange={e => setApproveNotes(e.target.value)}
                      className="w-full border border-border rounded-md p-2 text-sm"
                      rows={2}
                      placeholder="Add notes..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(selectedDriver)}
                      className="bg-green-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      ✓ Approve Driver
                    </button>
                    <button
                      onClick={() => { setRejectModalOpen(true); }}
                      className="bg-red-500 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      ✗ Reject Driver
                    </button>
                  </div>
                </div>
              )}
              {selectedDriver.tenantApprovalStatus === 'pending_approval' && !canApprove && (
                <div className="border-t border-border pt-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                    ⏳ Awaiting tenant approval
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && selectedDriver && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) { setRejectModalOpen(false); }}}>
          <div className="bg-white rounded-lg shadow-lg border border-border w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-1">Reject {selectedDriver.firstName} {selectedDriver.surName}?</h3>
            <p className="text-sm text-text-secondary mb-4">Please provide a reason for rejection.</p>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              className="w-full border border-border rounded-md p-2 text-sm mb-4"
              rows={3}
              placeholder="Reason for rejection..."
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => handleReject(selectedDriver)}
                disabled={!rejectNotes.trim()}
                className="bg-red-500 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject Driver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-brand-dark text-white px-4 py-3 rounded-lg shadow-lg text-sm z-[400]">
          {toast}
        </div>
      )}
    </div>
  );
}
