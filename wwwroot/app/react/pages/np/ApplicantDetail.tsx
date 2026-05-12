import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApplicant } from '@/hooks/useRecruitment';
import { recruitmentService } from '@/services/np_recruitmentService';
import type { ApplicantPipelineStage, ApplicantDocumentSummary } from '@/types';

const STAGES: ApplicantPipelineStage[] = [
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

/* ── AI Verification Result ── */
interface AiVerification {
  fieldName: string;
  extractedValue: string;
  confidence: number;
  matchesApplication: boolean | null; // null = can't verify against application
}

function mockAiVerification(doc: ApplicantDocumentSummary, applicantName: string): AiVerification[] {
  if (doc.documentTypeName === "Driver's License") {
    return [
      { fieldName: 'Full Name', extractedValue: applicantName, confidence: 98, matchesApplication: true },
      { fieldName: 'License Number', extractedValue: 'DL-' + Math.random().toString(36).substring(2, 8).toUpperCase(), confidence: 96, matchesApplication: null },
      { fieldName: 'Expiry Date', extractedValue: doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'Not detected', confidence: doc.expiryDate ? 94 : 0, matchesApplication: null },
      { fieldName: 'Date of Birth', extractedValue: '1990-05-15', confidence: 92, matchesApplication: null },
      { fieldName: 'Address', extractedValue: '450 N Clark St, Chicago, IL', confidence: 85, matchesApplication: true },
      { fieldName: 'Document Valid', extractedValue: doc.expiryDate && new Date(doc.expiryDate) > new Date() ? 'Yes — not expired' : 'Check manually', confidence: doc.expiryDate ? 99 : 0, matchesApplication: null },
    ];
  }
  if (doc.documentTypeName === 'Vehicle Registration') {
    return [
      { fieldName: 'Plate Number', extractedValue: 'IL-NEW001', confidence: 97, matchesApplication: true },
      { fieldName: 'Vehicle Make/Model', extractedValue: 'Ford Transit', confidence: 93, matchesApplication: true },
      { fieldName: 'Expiry Date', extractedValue: doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'Not detected', confidence: 91, matchesApplication: null },
      { fieldName: 'Registered Owner', extractedValue: applicantName, confidence: 88, matchesApplication: true },
    ];
  }
  if (doc.documentTypeName === 'Insurance Certificate') {
    return [
      { fieldName: 'Policy Number', extractedValue: 'POL-' + Math.random().toString(36).substring(2, 8).toUpperCase(), confidence: 95, matchesApplication: null },
      { fieldName: 'Insured Name', extractedValue: applicantName, confidence: 92, matchesApplication: true },
      { fieldName: 'Coverage Type', extractedValue: 'Commercial Vehicle — Comprehensive', confidence: 89, matchesApplication: null },
      { fieldName: 'Expiry Date', extractedValue: doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'Not detected', confidence: 90, matchesApplication: null },
      { fieldName: 'Liability Limit', extractedValue: '$2,000,000', confidence: 87, matchesApplication: null },
    ];
  }
  if (doc.documentTypeName === 'Contract') {
    return [
      { fieldName: 'Signatory Name', extractedValue: applicantName, confidence: 96, matchesApplication: true },
      { fieldName: 'Signature Present', extractedValue: 'Yes — signature detected', confidence: 94, matchesApplication: null },
      { fieldName: 'Date Signed', extractedValue: doc.uploadedDate ? new Date(doc.uploadedDate).toLocaleDateString() : '—', confidence: 91, matchesApplication: null },
    ];
  }
  if (doc.documentTypeName === 'DG Certificate') {
    return [
      { fieldName: 'Holder Name', extractedValue: applicantName, confidence: 94, matchesApplication: true },
      { fieldName: 'Certificate Number', extractedValue: 'DG-' + Math.random().toString(36).substring(2, 6).toUpperCase(), confidence: 90, matchesApplication: null },
      { fieldName: 'Expiry Date', extractedValue: doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'Not detected', confidence: 88, matchesApplication: null },
      { fieldName: 'Classes Covered', extractedValue: 'Class 2, 3, 6, 8', confidence: 85, matchesApplication: null },
    ];
  }
  return [
    { fieldName: 'Document Type', extractedValue: doc.documentTypeName, confidence: 80, matchesApplication: null },
  ];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  verified: { label: 'Verified', bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: '✅' },
  uploaded: { label: 'Pending Review', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '🔄' },
  missing: { label: 'Missing', bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', icon: '⬜' },
  rejected: { label: 'Rejected', bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: '❌' },
  expired: { label: 'Expired', bg: 'bg-red-50 border-red-200', text: 'text-red-600', icon: '⚠️' },
};

/* ── Document Card ── */
function DocumentCard({
  doc,
  applicantName,
  onVerify,
  onReject,
}: {
  doc: ApplicantDocumentSummary;
  applicantName: string;
  onVerify: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(doc.status === 'uploaded'); // auto-expand pending docs
  const config = STATUS_CONFIG[doc.status] || STATUS_CONFIG.missing;
  const aiFields = (doc.status === 'uploaded' || doc.status === 'verified') ? mockAiVerification(doc, applicantName) : [];
  const overallConfidence = aiFields.length > 0 ? Math.round(aiFields.reduce((s, f) => s + f.confidence, 0) / aiFields.length) : 0;
  const allMatch = aiFields.filter(f => f.matchesApplication !== null).every(f => f.matchesApplication);
  const hasMismatch = aiFields.some(f => f.matchesApplication === false);

  return (
    <div className={`border rounded-lg overflow-hidden ${config.bg}`}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
      >
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-text-primary">{doc.documentTypeName}</span>
            {doc.mandatory && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">Required</span>}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-3">
            {doc.fileName && <span>📎 {doc.fileName}</span>}
            {doc.uploadedDate && <span>Uploaded {new Date(doc.uploadedDate).toLocaleDateString()}</span>}
            {doc.expiryDate && <span>Expires {new Date(doc.expiryDate).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* AI confidence badge */}
          {(doc.status === 'uploaded' || doc.status === 'verified') && overallConfidence > 0 && (
            <div className={`text-xs font-bold px-2 py-1 rounded-full ${
              overallConfidence >= 90 ? 'bg-green-100 text-green-700' :
              overallConfidence >= 70 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              🤖 {overallConfidence}%
            </div>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${config.bg} ${config.text}`}>
            {config.label}
          </span>
          <span className="text-text-secondary text-sm">{expanded ? '▼' : '▶'}</span>
        </div>
      </button>

      {/* Expanded: AI extraction results + actions */}
      {expanded && (doc.status === 'uploaded' || doc.status === 'verified') && (
        <div className="border-t border-border/50">
          {/* AI extraction header */}
          <div className="px-4 py-2 bg-white/60 flex items-center gap-2">
            <img src="/auto-mate-face.png" alt="" className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-xs font-semibold text-brand-dark">Auto-Mate Document Analysis</span>
            {allMatch && !hasMismatch && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">All fields match application</span>}
            {hasMismatch && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600">⚠️ Mismatch detected</span>}
          </div>

          {/* Extracted fields table */}
          <div className="px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-secondary">
                  <th className="text-left py-1 font-medium">Field</th>
                  <th className="text-left py-1 font-medium">Extracted Value</th>
                  <th className="text-center py-1 font-medium">Confidence</th>
                  <th className="text-center py-1 font-medium">Match</th>
                </tr>
              </thead>
              <tbody>
                {aiFields.map((field, i) => (
                  <tr key={i} className={`border-t border-border/30 ${field.matchesApplication === false ? 'bg-red-50' : ''}`}>
                    <td className="py-1.5 text-text-secondary">{field.fieldName}</td>
                    <td className="py-1.5 font-medium text-text-primary">{field.extractedValue}</td>
                    <td className="py-1.5 text-center">
                      <span className={`font-bold ${field.confidence >= 90 ? 'text-green-600' : field.confidence >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                        {field.confidence}%
                      </span>
                    </td>
                    <td className="py-1.5 text-center">
                      {field.matchesApplication === true && <span className="text-green-600">✓</span>}
                      {field.matchesApplication === false && <span className="text-red-600 font-bold">✗</span>}
                      {field.matchesApplication === null && <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Document preview placeholder */}
          <div className="px-4 py-3 bg-white/40 border-t border-border/30">
            <div className="h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              <div className="text-center text-text-secondary">
                <div className="text-2xl mb-1">📄</div>
                <div className="text-xs">Document preview</div>
                <div className="text-[10px] text-text-muted">{doc.fileName || 'No file'}</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {doc.status === 'uploaded' && (
            <div className="px-4 py-3 bg-white/60 border-t border-border/30 flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onVerify(); }}
                className="flex-1 bg-green-600 text-white py-2 rounded-md text-xs font-semibold hover:bg-green-700 transition-colors"
              >
                ✅ Verify Document
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="flex-1 bg-white border border-red-300 text-red-600 py-2 rounded-md text-xs font-semibold hover:bg-red-50 transition-colors"
              >
                ❌ Reject — Request Re-upload
              </button>
            </div>
          )}
          {doc.status === 'verified' && (
            <div className="px-4 py-2 bg-green-50/50 border-t border-border/30 text-center">
              <span className="text-xs text-green-700 font-medium">✅ Verified and compliant</span>
            </div>
          )}
        </div>
      )}

      {/* Missing doc — upload prompt */}
      {expanded && doc.status === 'missing' && (
        <div className="border-t border-border/30 px-4 py-4 text-center">
          <div className="text-sm text-text-secondary mb-2">This document has not been uploaded yet</div>
          <div className="text-xs text-text-muted">The applicant needs to upload this via the Courier Portal</div>
        </div>
      )}
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

  const stageIdx = STAGES.indexOf(applicant.pipelineStage);
  const isRejected = !!applicant.rejectedDate;
  const isApproved = !!applicant.approvedAsCourierId;
  const applicantName = `${applicant.firstName} ${applicant.lastName}`;
  const docs = applicant.documents || [];
  const mandatoryDocs = docs.filter(d => d.mandatory);
  const verifiedCount = mandatoryDocs.filter(d => d.status === 'verified').length;
  const pendingCount = docs.filter(d => d.status === 'uploaded').length;

  const handleAdvance = () => {
    recruitmentService.advanceStage(applicant.id);
    refresh();
  };

  const handleReject = () => {
    recruitmentService.rejectApplicant(applicant.id, rejectReason);
    setShowRejectModal(false);
    refresh();
  };

  const handleApprove = () => {
    recruitmentService.approveApplicant(applicant.id);
    refresh();
  };

  const handleVerifyDoc = (docName: string) => {
    const doc = docs.find(d => d.documentTypeName === docName);
    if (doc) doc.status = 'verified';
    refresh();
  };

  const handleRejectDoc = (docName: string) => {
    const doc = docs.find(d => d.documentTypeName === docName);
    if (doc) doc.status = 'rejected';
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
            {stageIdx < STAGES.length - 1 && (
              <button onClick={handleAdvance} className="px-4 py-2 text-sm font-medium bg-brand-cyan text-white rounded-lg hover:bg-brand-cyan/90">
                Advance Stage
              </button>
            )}
            {stageIdx === STAGES.length - 1 && (
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
          {STAGES.map((_, i) => (
            <div key={i} className="flex-1 flex items-center">
              <div className={`flex-1 h-2 rounded-full ${i <= stageIdx ? 'bg-brand-cyan' : 'bg-gray-200'}`} />
              {i < STAGES.length - 1 && <div className="w-1" />}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {STAGES.map((stage, i) => (
            <span key={stage} className={`text-[10px] flex-1 text-center ${i <= stageIdx ? 'text-brand-cyan font-medium' : 'text-text-muted'}`}>
              {stage}
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
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-secondary">
              {verifiedCount}/{mandatoryDocs.length} required docs verified
            </span>
            {pendingCount > 0 && (
              <span className="text-amber-600 font-medium">🔄 {pendingCount} pending review</span>
            )}
            {verifiedCount === mandatoryDocs.length && mandatoryDocs.length > 0 && (
              <span className="text-green-600 font-medium">✅ All required docs verified — ready to advance</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${mandatoryDocs.length ? (verifiedCount / mandatoryDocs.length) * 100 : 0}%` }} />
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${mandatoryDocs.length ? (mandatoryDocs.filter(d => d.status === 'uploaded').length / mandatoryDocs.length) * 100 : 0}%` }} />
              </div>
              <span className="text-sm font-bold text-text-primary">{mandatoryDocs.length ? Math.round((verifiedCount / mandatoryDocs.length) * 100) : 0}%</span>
            </div>
            <div className="flex gap-4 text-[11px] text-text-secondary">
              <span>✅ {verifiedCount} Verified</span>
              <span>🔄 {docs.filter(d => d.status === 'uploaded').length} Pending</span>
              <span>⬜ {docs.filter(d => d.status === 'missing').length} Missing</span>
              <span>❌ {docs.filter(d => d.status === 'rejected').length} Rejected</span>
            </div>
          </div>

          {/* Document cards — pending first, then verified, then missing */}
          <div className="space-y-3">
            {[...docs]
              .sort((a, b) => {
                const order: Record<string, number> = { uploaded: 0, rejected: 1, verified: 2, expired: 3, missing: 4 };
                return (order[a.status] ?? 5) - (order[b.status] ?? 5);
              })
              .map((doc, i) => (
                <DocumentCard
                  key={i}
                  doc={doc}
                  applicantName={applicantName}
                  onVerify={() => handleVerifyDoc(doc.documentTypeName)}
                  onReject={() => handleRejectDoc(doc.documentTypeName)}
                />
              ))}
          </div>
        </div>
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
    </div>
  );
}
