// AgentDocumentPreviewModal — staff-side inline preview for an uploaded agent
// business document, with a right-hand info panel showing the stored metadata,
// the advisory Claude AI review (Phase 3a / 3b) and the Verify / Reject actions.
//
// Replaces the bare "Download" link on the AgentWorkspace ComplianceTab doc
// table. Spec:
//   docs/STEVE-AGENT-DOCUMENT-PREVIEW-MODAL-2026-06-13.md
//
// Source of truth:
//   - Document metadata          : staffAgentDocsApi.list(agentId)
//   - File bytes (preview)       : staffAgentDocsApi.downloadUrl(agentId, id)
//                                  served as /api/v1/np/agents/{agentId}/documents/{id}/download
//   - Verify / Reject actions    : staffAgentDocsApi.verify / reject
//
// MIME handling:
//   - application/pdf       → <iframe>  (browser-native PDF viewer)
//   - image/png|jpeg|gif|webp → <img>
//   - everything else       → fallback "preview not available" panel + Download
//
// NP side gets no preview surface — this is tenant-staff only.

import { useEffect, useState } from 'react';
import { staffAgentDocsApi, type AgentDocument } from '@/services/np_agentComplianceService';

interface Props {
  isOpen: boolean;
  agentId: number;
  document: AgentDocument | null;
  onClose: () => void;
  onChanged: () => void;
}

const PREVIEWABLE_IMAGE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const PREVIEWABLE_PDF   = 'application/pdf';

function decisionTone(decision?: string | null): string {
  switch (decision) {
    case 'accept':       return 'bg-green-50 text-green-700 ring-1 ring-green-200';
    case 'reject':       return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    case 'needs_review': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    default:             return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200';
  }
}
function decisionLabel(decision?: string | null): string {
  switch (decision) {
    case 'accept':       return 'Accept';
    case 'reject':       return 'Reject';
    case 'needs_review': return 'Needs review';
    default:             return '—';
  }
}
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

export function AgentDocumentPreviewModal({ isOpen, agentId, document, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState<'verify' | 'reject' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      window.document.body.style.overflow = 'hidden';
    } else {
      window.document.body.style.overflow = '';
      setRejecting(false);
      setRejectReason('');
      setBusy(null);
      setError(null);
    }
    return () => { window.document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !document) return null;

  const url = staffAgentDocsApi.downloadUrl(agentId, document.id);
  const ct = (document.contentType || '').toLowerCase();
  const isImage = PREVIEWABLE_IMAGE.has(ct);
  const isPdf   = ct === PREVIEWABLE_PDF;
  const canPreview = isImage || isPdf;

  const onVerify = async () => {
    try {
      setError(null);
      setBusy('verify');
      await staffAgentDocsApi.verify(agentId, document.id);
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Verify failed');
    } finally {
      setBusy(null);
    }
  };

  const onConfirmReject = async () => {
    try {
      setError(null);
      setBusy('reject');
      await staffAgentDocsApi.reject(agentId, document.id, rejectReason.trim() || 'Rejected');
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Reject failed');
    } finally {
      setBusy(null);
    }
  };

  const pending = document.verifyStatus === 'Pending';

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

          {/* Right — info + actions pane */}
          <aside className="overflow-y-auto bg-white">
            <div className="p-5 space-y-5">

              {/* Status */}
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-2">Status</h3>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${verifyTone(document.verifyStatus)}`}>
                  {document.verifyStatus}
                </span>
                {document.verifyStatus === 'Verified' && (
                  <p className="mt-1 text-xs text-text-muted">Verified {formatDate(document.verifiedDate)}{document.verifiedBy ? ` by ${document.verifiedBy}` : ''}.</p>
                )}
                {document.verifyStatus === 'Rejected' && document.rejectReason && (
                  <p className="mt-1 text-xs text-red-700">Reason: {document.rejectReason}</p>
                )}
              </section>

              {/* Stored metadata */}
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-2">Document</h3>
                <dl className="text-sm divide-y divide-border-light">
                  <Row label="Stored expiry" value={document.expiryDate ?? '—'} />
                  <Row label="Uploaded" value={`${formatDate(document.uploadedDate)}${document.uploadedBy ? ` · ${document.uploadedBy}` : ''}`} />
                  <Row label="File" value={`${document.fileName} (${formatBytes(document.length)})`} />
                </dl>
              </section>

              {/* AI suggestion */}
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-2">AI review</h3>
                {document.aiSuggestedDecision ? (
                  <div className="space-y-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${decisionTone(document.aiSuggestedDecision)}`}>
                      {decisionLabel(document.aiSuggestedDecision)}
                    </span>
                    {document.aiSuggestedExpiry && (
                      <dl className="text-sm divide-y divide-border-light">
                        <Row label="Suggested expiry" value={document.aiSuggestedExpiry} />
                      </dl>
                    )}
                    {document.aiRationale && (
                      <p className="text-xs text-text-secondary whitespace-pre-wrap">{document.aiRationale}</p>
                    )}
                    <p className="text-[11px] text-text-muted italic">Advisory only — staff decision is final.</p>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No AI review on this document.</p>
                )}
              </section>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">
                  {error}
                </div>
              )}

            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-light flex-shrink-0 flex flex-wrap items-center gap-2 justify-end bg-white">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50 px-3 py-1.5 text-sm font-medium"
          >
            Download
          </a>

          {pending && (
            <>
              <button
                onClick={onVerify}
                disabled={busy !== null}
                className="rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {busy === 'verify' ? 'Verifying…' : 'Verify'}
              </button>
              <button
                onClick={() => setRejecting(true)}
                disabled={busy !== null}
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50 px-3 py-1.5 text-sm font-medium"
          >
            Close
          </button>
        </div>

        {/* Inline reject confirmation */}
        {rejecting && (
          <div className="absolute inset-0 bg-white/96 flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-3">
              <h3 className="text-base font-bold text-text-primary">Reject this document?</h3>
              <p className="text-sm text-text-secondary">Tell the agent what to fix. They'll see the reason on their My Documents page.</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Expiry date is in the past — please upload a current copy."
                className="w-full rounded-lg border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setRejecting(false); setRejectReason(''); }}
                  className="rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50 px-3 py-1.5 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirmReject}
                  disabled={busy !== null}
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
                </button>
              </div>
            </div>
          </div>
        )}
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
