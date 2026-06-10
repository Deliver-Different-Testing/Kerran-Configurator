import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  myAgentDocsApi,
  type AgentComplianceDetail,
  type AgentDocRequirementStatus,
  type AgentDocStatus,
} from '@/services/np_agentComplianceService';

// NP self-service compliance documents (Phase 2). A Network Partner uploads its
// own business documents here; tenant staff verify/reject elsewhere. The agent
// is resolved server-side from the caller's scope — this surface is read+upload
// only (no verify/reject). Drives everything off the own-agent scorecard.

const STATUS_META: Record<AgentDocStatus, { label: string; tone: string }> = {
  approved:     { label: 'Approved',     tone: 'bg-green-100 text-green-700' },
  under_review: { label: 'Under Review', tone: 'bg-amber-100 text-amber-700' },
  rejected:     { label: 'Rejected',     tone: 'bg-red-100 text-red-700' },
  missing:      { label: 'Not Uploaded', tone: 'bg-slate-100 text-slate-600' },
};

function StatusPill({ status }: { status: AgentDocStatus }) {
  const meta = STATUS_META[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.tone}`}>{meta.label}</span>;
}

export default function MyComplianceDocuments() {
  const [detail, setDetail] = useState<AgentComplianceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTypeId, setSelectedTypeId] = useState<number | ''>('');
  const [expiry, setExpiry] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await myAgentDocsApi.getCompliance());
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to load your compliance documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const requirements = detail?.requirements ?? [];
  const summary = detail?.summary;

  // Default the upload picker to the first outstanding requirement.
  useEffect(() => {
    if (selectedTypeId === '' && requirements.length) {
      const firstOutstanding = requirements.find((r) => r.status === 'missing' || r.status === 'rejected');
      setSelectedTypeId((firstOutstanding ?? requirements[0]).documentTypeId);
    }
  }, [requirements, selectedTypeId]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (selectedTypeId === '' || !file) {
      setUploadError('Pick a document type and choose a file.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await myAgentDocsApi.upload(Number(selectedTypeId), file, expiry || null);
      if (fileRef.current) fileRef.current.value = '';
      setExpiry('');
      await refresh();
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const docIdByType = useMemo(() => {
    const map = new Map<number, number>();
    requirements.forEach((r) => { if (r.documentId) map.set(r.documentTypeId, r.documentId); });
    return map;
  }, [requirements]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">My Compliance Documents</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload your business documents for review. Your tenant reviews and approves each one — you'll
          see the status update here.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Required Approved</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{summary.approvedMandatoryDocuments}/{summary.mandatoryDocuments}</div>
            <div className="mt-1 text-sm text-text-secondary">{detail?.compliancePercent ?? 0}% complete</div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Under Review</div>
            <div className="mt-2 text-3xl font-bold text-amber-700">{summary.pendingDocuments}</div>
            <div className="mt-1 text-sm text-text-secondary">Awaiting tenant review.</div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Rejected</div>
            <div className="mt-2 text-3xl font-bold text-red-700">{summary.rejectedDocuments}</div>
            <div className="mt-1 text-sm text-text-secondary">Re-upload to resolve.</div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Not Uploaded</div>
            <div className="mt-2 text-3xl font-bold text-slate-600">{summary.missingDocuments}</div>
            <div className="mt-1 text-sm text-text-secondary">Required &amp; optional documents.</div>
          </div>
        </div>
      )}

      {/* Upload panel */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-text-primary">Upload a document</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Document type</label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
            >
              {requirements.map((r) => (
                <option key={r.documentTypeId} value={r.documentTypeId}>
                  {r.documentTypeName}{r.mandatory ? ' (required)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Expiry (optional)</label>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="rounded-xl border border-border px-3 py-2.5 text-sm" />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">File</label>
            <input ref={fileRef} type="file" className="w-full text-sm" />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-xl bg-brand-cyan px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-cyan/90 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {uploadError && <div className="mt-3 text-sm text-red-600">{uploadError}</div>}
      </section>

      {/* Requirements checklist */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-text-primary">Required documents</h2>
        {error ? (
          <div className="mt-4 text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="mt-4 text-sm text-text-muted">Loading…</div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Document</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Required</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Status</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Expiry</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">File</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r: AgentDocRequirementStatus) => {
                  const docId = docIdByType.get(r.documentTypeId);
                  return (
                    <tr key={r.documentTypeId} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-3 font-medium text-text-primary">{r.documentTypeName}</td>
                      <td className="px-3 py-3 text-text-secondary">{r.mandatory ? 'Required' : 'Optional'}</td>
                      <td className="px-3 py-3">
                        <StatusPill status={r.status} />
                        {r.status === 'approved' && r.source === 'onboarding' && (
                          <span className="ml-2 text-xs text-text-muted">(from onboarding)</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        {r.expiryDate ? <span className={r.isExpired ? 'text-red-600' : r.isExpiring ? 'text-amber-600' : ''}>{r.expiryDate}</span> : '—'}
                      </td>
                      <td className="px-3 py-3">
                        {docId ? (
                          <a href={myAgentDocsApi.downloadUrl(docId)} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-cyan hover:underline">Download</a>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
