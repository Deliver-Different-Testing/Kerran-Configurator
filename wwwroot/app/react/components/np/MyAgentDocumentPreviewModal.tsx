// MyAgentDocumentPreviewModal — NP-safe preview for the operator's OWN uploaded
// business documents. Cut-down mirror of the staff-side AgentDocumentPreviewModal:
// preview pane on the left, document metadata on the right, Download + Close in
// the footer. No AI advisory panel. No Verify / Reject buttons.
//
// Spec: docs/STEVE-COMPLIANCE-BUNDLE-2026-06-13.md §3.2
//
// Source of truth:
//   - Document metadata          : myAgentDocsApi.list() (already fetched by caller)
//   - File bytes (preview)       : myAgentDocsApi.downloadUrl(id)
//                                  served as /api/v1/np/my-documents/{id}/download
//
// The AI advisory columns on AgentDocument (aiSuggestedDecision / aiSuggestedExpiry /
// aiRationale) are deliberately NOT rendered here — NPs do not see Claude's review.
// The Reject reason IS shown when the document is in Rejected status, because that
// is the staff's instruction to the NP to fix.

import { useEffect } from 'react';
import { myAgentDocsApi, type AgentDocument } from '@/services/np_agentComplianceService';

interface Props {
  isOpen: boolean;
  document: AgentDocument | null;
  onClose: () => void;
}

const PREVIEWABLE_IMAGE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const PREVIEWABLE_PDF   = 'application/pdf';

function verifyTone(status?: string | null): string {
  switch (status) {
    case 'Verified': return 'bg-green-50 text-green-700 ring-1 ring-green-200';
    case 'Rejected': return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    case 'Pending':  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    default:         return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200';
  }
}
function formatBytes(n?: number): string {
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString();
}

export function MyAgentDocumentPreviewModal({ isOpen, document, onClose }: Props) {
  useEffect(() => {
    if (isOpen) window.document.body.style.overflow = 'hidden';
    else        window.document.body.style.overflow = '';
    return () => { window.document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !document) return null;

  const url = myAgentDocsApi.downloadUrl(document.id);
  const ct = (document.contentType || '').toLowerCase();
  const isImage = PREVIEWABLE_IMAGE.has(ct);
  const isPdf   = ct === PREVIEWABLE_PDF;
  const canPreview = isImage || isPdf;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-[min(1280px,96vw)] h-[min(820px,92vh)] mx-4 flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-5 py-3 border-b border-border-light flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-text-primary truncate">{document.documentTypeName}</h2>
            <p className="text-xs text-text-muted truncate">{document.fileName} · {formatBytes(document.length)} · {document.contentType || 'unknown type'}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none ml-4" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_360px] min-h-0">

          {/* Left — preview pane */}
          <div className="bg-slate-100 border-r border-border-light min-h-0 overflow-hidden flex items-center justify-center">
            {isPdf && (
              <iframe
                src={url}
                title={document.fileName}
                className="w-full h-full bg-white"
              />
            )}
            {isImage && (
              <img
                src={url}
                alt={document.fileName}
                className="max-w-full max-h-full object-contain"
              />
            )}
            {!canPreview && (
              <div className="text-center px-6 py-10">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm text-text-secondary mb-1">Preview not available for this file type.</p>
                <p className="text-xs text-text-muted mb-4">{document.contentType || 'Unknown content type'}</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/15 px-3 py-1.5 text-sm font-medium"
                >
                  Download to view
                </a>
              </div>
            )}
          </div>

          {/* Right — info pane (no AI section, no actions). */}
          <aside className="overflow-y-auto bg-white">
            <div className="p-5 space-y-5">

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-2">Status</h3>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${verifyTone(document.verifyStatus)}`}>
                  {document.verifyStatus}
                </span>
                {document.verifyStatus === 'Verified' && (
                  <p className="mt-1 text-xs text-text-muted">Verified {formatDate(document.verifiedDate)}{document.verifiedBy ? ` by ${document.verifiedBy}` : ''}.</p>
                )}
                {document.verifyStatus === 'Rejected' && document.rejectReason && (
                  // Staff's note to the NP on what to fix — show in full.
                  <p className="mt-1 text-xs text-red-700 whitespace-pre-wrap">Reason: {document.rejectReason}</p>
                )}
                {document.verifyStatus === 'Pending' && (
                  <p className="mt-1 text-xs text-text-muted">Awaiting review by your tenant. You'll see the outcome on this page once it's decided.</p>
                )}
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-2">Document</h3>
                <dl className="text-sm divide-y divide-border-light">
                  <Row label="Stored expiry" value={document.expiryDate ?? '—'} />
                  <Row label="Uploaded" value={`${formatDate(document.uploadedDate)}${document.uploadedBy ? ` · ${document.uploadedBy}` : ''}`} />
                  <Row label="File" value={`${document.fileName} (${formatBytes(document.length)})`} />
                </dl>
              </section>

            </div>
          </aside>
        </div>

        {/* Footer — Download + Close only. No staff actions. */}
        <div className="px-5 py-3 border-t border-border-light flex-shrink-0 flex flex-wrap items-center gap-2 justify-end bg-white">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50 px-3 py-1.5 text-sm font-medium"
          >
            Download
          </a>
          <button
            onClick={onClose}
            className="rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50 px-3 py-1.5 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary text-right break-words min-w-0">{value}</dd>
    </div>
  );
}
