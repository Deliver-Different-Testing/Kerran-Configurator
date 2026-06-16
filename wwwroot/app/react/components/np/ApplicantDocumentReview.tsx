import { useEffect, useState } from 'react';
import { applicantDocReviewService } from '@/services/np_documentService';
import { CourierDocumentPreviewModal } from '@/components/np/CourierDocumentPreviewModal';
import type { CourierDocument } from '@/types';

// P3 (Slice B2) — staff/NP review of an applicant's uploaded documents (the
// unified CourierDocuments keyed by ApplicantId). Lists the applicant's uploads
// with the AI advisory + a Review button (inline preview + Verify/Reject via the
// shared CourierDocumentPreviewModal). On approval these carry forward to the
// courier (P4).

function statusChip(status: string) {
  const map: Record<string, string> = {
    Verified: 'bg-green-50 text-green-700',
    Pending: 'bg-amber-50 text-amber-700',
    Rejected: 'bg-red-50 text-red-700',
  };
  const label = status === 'Pending' ? 'Pending review' : status;
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-50 text-slate-600'}`}>{label}</span>;
}

function aiChip(decision: string | null) {
  if (!decision) return null;
  const tone = decision === 'accept' ? 'text-green-600' : decision === 'reject' ? 'text-red-500' : 'text-amber-600';
  const label = decision === 'accept' ? 'Accept' : decision === 'reject' ? 'Reject' : 'Needs review';
  return <span className={`text-xs ${tone}`}>AI: {label}</span>;
}

export default function ApplicantDocumentReview({ applicantId }: { applicantId: number }) {
  const [docs, setDocs] = useState<CourierDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CourierDocument | null>(null);

  async function refresh() {
    try { setDocs(await applicantDocReviewService.list(applicantId)); }
    catch (e: any) { setError(e?.message ?? 'Could not load documents.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [applicantId]);

  if (loading) return <div className="bg-white rounded-lg border border-border p-4 text-sm text-text-muted">Loading documents…</div>;
  if (error) return <div className="bg-white rounded-lg border border-red-200 p-4 text-sm text-red-700">⚠️ {error}</div>;
  if (docs.length === 0) return <div className="bg-white rounded-lg border border-border p-4 text-sm text-text-muted">This applicant hasn't uploaded any documents yet.</div>;

  return (
    <div className="space-y-2">
      {docs.map(doc => (
        <div key={doc.id} className="bg-white rounded-lg border border-border p-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary flex items-center gap-2 flex-wrap">
              {doc.documentTypeName}
              {statusChip(doc.verifyStatus)}
              {aiChip(doc.aiSuggestedDecision)}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {doc.fileName} · Uploaded {new Date(doc.uploadedDate).toLocaleDateString()}
              {doc.expiryDate && <> · Expires {new Date(doc.expiryDate).toLocaleDateString()}</>}
            </div>
            {doc.verifyStatus === 'Rejected' && doc.rejectReason && (
              <div className="text-xs text-red-700 mt-0.5">Rejected: {doc.rejectReason}</div>
            )}
          </div>
          <button onClick={() => setPreviewDoc(doc)} className="text-xs bg-brand-cyan text-brand-dark px-3 py-1.5 rounded-md font-medium hover:shadow-cyan-glow shrink-0">Review</button>
        </div>
      ))}

      <CourierDocumentPreviewModal
        isOpen={previewDoc !== null}
        document={previewDoc}
        downloadUrl={previewDoc ? applicantDocReviewService.downloadUrl(applicantId, previewDoc.id) : ''}
        onVerify={async () => { if (previewDoc) { await applicantDocReviewService.verify(applicantId, previewDoc.id); refresh(); } }}
        onReject={async (reason) => { if (previewDoc) { await applicantDocReviewService.reject(applicantId, previewDoc.id, reason); refresh(); } }}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
