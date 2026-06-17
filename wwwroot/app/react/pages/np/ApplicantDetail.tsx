import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useApplicant } from '@/hooks/useRecruitment';
import { recruitmentService } from '@/services/np_recruitmentService';
import { recruitmentSettingsService } from '@/services/np_recruitmentSettingsService';
import ApplicantDocumentReview from '@/components/np/ApplicantDocumentReview';
import type { ApplicantPipelineStage, RecruitmentStageConfig } from '@/types';

// Canonical order — used only as a fallback when the stage config hasn't
// loaded (or hasn't been seeded). The live progress bar renders the ENABLED
// stages from /api/v1/np/recruitment-stages instead (see stage config below).
const FALLBACK_STAGES: ApplicantPipelineStage[] = [
  'Registration', 'Email Verification', 'Profile', 'Documentation',
  'Declaration/Contract', 'Training', 'Approval',
];

type Tab = 'profile' | 'documents' | 'timeline';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className="text-sm text-text-primary">{value || '—'}</div>
    </div>
  );
}

/* ── Main Component ── */
export default function ApplicantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { applicant, refresh } = useApplicant(Number(id));
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveFleetId, setApproveFleetId] = useState<number | null>(null);
  const [approveCode, setApproveCode] = useState('');
  const [fleets, setFleets] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { recruitmentService.getCourierFleets().then(setFleets); }, []);
  const [stageConfig, setStageConfig] = useState<RecruitmentStageConfig[] | null>(null);
  useEffect(() => {
    recruitmentSettingsService.getStages().then(setStageConfig).catch(() => setStageConfig(null));
  }, []);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  if (!applicant) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-text-primary mb-2">Applicant not found</h2>
        <button onClick={() => navigate('/recruitment')} className="text-brand-cyan hover:underline text-sm">
          Back to pipeline
        </button>
      </div>
    );
  }

  // Build the progress bar from the configurable stages. All stages (enabled
  // + disabled) ordered by sortOrder give the canonical position; we render
  // only the ENABLED ones, and mark each complete if its canonical position is
  // at or before the applicant's derived stage. Falls back to the canonical
  // list until the config loads (or if it was never seeded).
  const sortedAll: Pick<RecruitmentStageConfig, 'stageName' | 'sortOrder' | 'enabled'>[] =
    stageConfig && stageConfig.length
      ? [...stageConfig].sort((a, b) => a.sortOrder - b.sortOrder)
      : FALLBACK_STAGES.map((stageName, i) => ({ stageName, sortOrder: i, enabled: true }));
  const derivedPos = sortedAll.findIndex(s => s.stageName === applicant.pipelineStage);
  const barStages = sortedAll
    .filter(s => s.enabled)
    .map(s => ({ name: s.stageName, completed: derivedPos >= 0 && sortedAll.indexOf(s) <= derivedPos }));
  // The advance/activate flow is flag-based on the backend regardless of which
  // stages are enabled, so key the final action off the derived stage directly.
  const isFinalStage = applicant.pipelineStage === 'Approval';
  const isRejected = !!applicant.rejectedDate;
  const isApproved = !!applicant.approvedAsCourierId;
  const applicantName = `${applicant.firstName} ${applicant.lastName}`;
  const docs = applicant.documents || [];
  const pendingCount = docs.filter(d => d.status === 'uploaded').length;

  const handleAdvance = async () => {
    await recruitmentService.advanceStage(applicant.id);
    refresh();
  };

  const handleReject = async () => {
    await recruitmentService.rejectApplicant(applicant.id, rejectReason);
    setShowRejectModal(false);
    refresh();
  };

  const handleApprove = () => {
    setApproveFleetId(null);
    setApproveCode('');
    setShowApproveModal(true);
  };

  const confirmApprove = async () => {
    if (!approveFleetId) return;
    await recruitmentService.approveApplicant(applicant.id, {
      courierCode: approveCode,
      courierFleetId: approveFleetId,
    });
    setShowApproveModal(false);
    refresh();
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'documents', label: 'Documents', badge: pendingCount > 0 ? pendingCount : undefined },
    { key: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/recruitment')} className="text-text-muted hover:text-text-primary">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{applicantName}</h1>
          <p className="text-sm text-text-secondary">{applicant.email} · {applicant.city}, {applicant.state}</p>
        </div>
        {!isRejected && !isApproved && (
          <div className="flex items-center gap-2">
            {!isFinalStage && (
              <button onClick={handleAdvance} className="px-4 py-2 text-sm font-medium bg-brand-cyan text-white rounded-lg hover:bg-brand-cyan/90">
                Advance Stage
              </button>
            )}
            {isFinalStage && (
              <button onClick={handleApprove} className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                Activate as Courier
              </button>
            )}
            <button onClick={() => setShowRejectModal(true)} className="px-4 py-2 text-sm font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200">
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Status Banners */}
      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <span className="text-sm font-medium text-red-700">❌ Rejected</span>
          {applicant.rejectedReason && <span className="text-sm text-red-600 ml-2">— {applicant.rejectedReason}</span>}
        </div>
      )}
      {isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <span className="text-sm font-medium text-green-700">✅ Activated as Courier — ID #{applicant.approvedAsCourierId}</span>
        </div>
      )}

      {/* Stage Progress */}
      <div className="bg-white rounded-lg border border-border p-5">
        <div className="flex items-center gap-1">
          {barStages.map((s, i) => (
            <div key={`${s.name}-${i}`} className="flex-1 flex items-center">
              <div className={`flex-1 h-2 rounded-full ${s.completed ? 'bg-brand-cyan' : 'bg-gray-200'}`} />
              {i < barStages.length - 1 && <div className="w-1" />}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {barStages.map((s, i) => (
            <span key={`${s.name}-${i}`} className={`text-[10px] flex-1 text-center ${s.completed ? 'text-brand-cyan font-medium' : 'text-text-muted'}`}>
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === tab.key
                ? 'border-brand-cyan text-brand-cyan'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Personal Information">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" value={applicant.firstName} />
              <Field label="Last Name" value={applicant.lastName} />
              <Field label="Email" value={applicant.email} />
              <Field label="Phone" value={applicant.phone} />
              <Field label="Address" value={applicant.address} />
              <Field label="City" value={applicant.city} />
              <Field label="State" value={applicant.state} />
              <Field label="Postcode" value={applicant.postcode} />
            </div>
          </Section>

          <Section title="Vehicle Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vehicle Type" value={applicant.vehicleType} />
              <Field label="Make" value={applicant.vehicleMake} />
              <Field label="Model" value={applicant.vehicleModel} />
              <Field label="Year" value={applicant.vehicleYear} />
              <Field label="Plate" value={applicant.vehiclePlate} />
            </div>
          </Section>

          <Section title="Banking Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Account Name" value={applicant.bankAccountName} />
              <Field label="Account Number" value={applicant.bankAccountNumber} />
              <Field label="BSB" value={applicant.bankBSB} />
            </div>
          </Section>

          <Section title="Next of Kin">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" value={applicant.nextOfKinName} />
              <Field label="Phone" value={applicant.nextOfKinPhone} />
              <Field label="Relationship" value={applicant.nextOfKinRelationship} />
            </div>
          </Section>

          <Section title="Declaration & Contract">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Declaration Signed" value={applicant.declarationSigned ? 'Yes' : 'No'} />
              <Field label="Signed Date" value={applicant.declarationSignedDate ? new Date(applicant.declarationSignedDate).toLocaleDateString() : null} />
            </div>
          </Section>

          <Section title="Meta">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Created" value={new Date(applicant.createdDate).toLocaleDateString()} />
              <Field label="Modified" value={applicant.modifiedDate ? new Date(applicant.modifiedDate).toLocaleDateString() : null} />
              <Field label="Notes" value={applicant.notes} />
            </div>
          </Section>
        </div>
      )}

      {activeTab === 'documents' && (
        <ApplicantDocumentReview applicantId={applicant.id} />
      )}

      {activeTab === 'timeline' && (
        <div className="bg-white rounded-lg border border-border p-5">
          <div className="space-y-4">
            {[
              { date: applicant.createdDate, event: 'Application submitted', detail: `${applicantName} submitted application via Courier Portal` },
              ...(docs.filter(d => d.uploadedDate).map(d => ({
                date: d.uploadedDate!,
                event: `${d.documentTypeName} uploaded`,
                detail: d.fileName || '',
              }))),
              ...(applicant.declarationSignedDate ? [{
                date: applicant.declarationSignedDate,
                event: 'Declaration signed',
                detail: 'Electronic signature captured',
              }] : []),
              ...(applicant.modifiedDate && applicant.modifiedDate !== applicant.createdDate ? [{
                date: applicant.modifiedDate,
                event: 'Application updated',
                detail: `Stage: ${applicant.pipelineStage}`,
              }] : []),
            ]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((entry, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-brand-cyan mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{entry.event}</span>
                      <span className="text-xs text-text-muted">{new Date(entry.date).toLocaleString()}</span>
                    </div>
                    {entry.detail && <div className="text-xs text-text-secondary mt-0.5">{entry.detail}</div>}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setShowRejectModal(false); }}>
          <div className="bg-white rounded-lg shadow-lg border border-border w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-text-primary mb-3">Reject Applicant</h2>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
              <button onClick={handleReject} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Approve / Activate Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setShowApproveModal(false); }}>
          <div className="bg-white rounded-lg shadow-lg border border-border w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-text-primary mb-1">Activate as Courier</h2>
            <p className="text-sm text-text-secondary mb-4">{applicantName} will be created as a courier record.</p>
            <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1.5">Assign to Fleet</label>
            <select
              value={approveFleetId ?? ''}
              onChange={e => setApproveFleetId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white mb-3"
            >
              <option value="">Select fleet...</option>
              {fleets.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
            <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1.5">Courier Code</label>
            <input
              value={approveCode}
              onChange={e => setApproveCode(e.target.value)}
              maxLength={50}
              placeholder="Auto-assigned if left blank"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowApproveModal(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
              <button onClick={confirmApprove} disabled={!approveFleetId} className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">Activate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
