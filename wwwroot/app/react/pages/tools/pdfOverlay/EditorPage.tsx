import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FieldMapperCanvas from './FieldMapperCanvas';
import FieldPropertiesPanel from './FieldPropertiesPanel';
import PdfPreview from './PdfPreview';
import { getOriginal, getTemplate, getVersions, renderPreview, saveMap } from './service';
import { newField } from './types';
import type { FieldMapping, TemplateDetail } from './types';
import { nextBindingKey } from './fieldKey';

const SCALE = 1.2;

// PDF Overlay tool — the visual field mapper. The field/validation/preview logic is ported verbatim
// from the pdf-overlay-tool AdminPortal EditorPage; the MUI chrome is rebuilt in Tailwind.
export default function PdfOverlayEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [versions, setVersions] = useState<number[]>([]);
  const [fields, setFields] = useState<FieldMapping[]>([]);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer>();
  const [previewData, setPreviewData] = useState<ArrayBuffer | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getTemplate(id)
      .then((d) => {
        setDetail(d);
        setFields(d.map.fields);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the template.'));
    getVersions(id).then(setVersions).catch(() => {});
    getOriginal(id).then(setPdfData).catch(() => setError('Could not load the PDF.'));
  }, [id]);

  const pageCount = detail?.pageCount ?? 1;
  const pageFields = useMemo(() => fields.filter((f) => f.page === page), [fields, page]);
  const selected = fields.find((f) => f.id === selectedId) ?? null;

  const idCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of fields) counts.set(f.id, (counts.get(f.id) ?? 0) + 1);
    return counts;
  }, [fields]);

  const idError = useMemo(() => {
    if (!selected) return undefined;
    if (!selected.id.trim()) return 'Binding key is required.';
    if ((idCounts.get(selected.id) ?? 0) > 1) return 'Binding key must be unique.';
    return undefined;
  }, [selected, idCounts]);

  const bindingError = useMemo(
    () => (selected && !selected.dataBinding?.trim() ? 'A data binding must be selected.' : undefined),
    [selected],
  );

  const hasIdErrors = useMemo(
    () => fields.some((f) => !f.id.trim()) || new Set(fields.map((f) => f.id)).size !== fields.length,
    [fields],
  );
  const hasBindingErrors = useMemo(() => fields.some((f) => !f.dataBinding?.trim()), [fields]);

  const addField = useCallback(() => {
    const existing = new Set(fields.map((f) => f.id));
    let n = fields.length + 1;
    while (existing.has(`field${n}`)) n += 1;
    const fid = `field${n}`;
    setFields((prev) => [...prev, newField(fid, page)]);
    setSelectedId(fid);
  }, [fields, page]);

  const updateField = useCallback((incoming: FieldMapping) => {
    const prevField = fields.find((f) => f.id === selectedId);
    let updated = incoming;
    if (prevField && incoming.label !== prevField.label) {
      const taken = new Set(fields.filter((f) => f.id !== selectedId).map((f) => f.id));
      updated = { ...incoming, id: nextBindingKey(prevField.id, prevField.label ?? '', incoming.label ?? '', taken) };
    }
    setFields((prev) => prev.map((f) => (f.id === selectedId ? updated : f)));
    if (updated.id !== selectedId) setSelectedId(updated.id);
  }, [fields, selectedId]);

  const onGeometry = useCallback(
    (fid: string, geom: Pick<FieldMapping, 'x' | 'y' | 'w' | 'h'>) =>
      setFields((prev) => prev.map((f) => (f.id === fid ? { ...f, ...geom } : f))),
    [],
  );

  const deleteField = useCallback((fid: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fid));
    setSelectedId(null);
  }, []);

  const preview = useCallback(async (version?: number) => {
    if (!id) return;
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === 'image' || f.type === 'barcode') continue;
      data[f.id] = f.type === 'date' ? '2026-06-22T10:00:00Z' : (f.label ?? f.id);
    }
    try {
      setPreviewData(await renderPreview(id, data, version));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed.');
    }
  }, [id, fields]);

  const closePreview = useCallback(() => setPreviewData(null), []);

  const save = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    setSavedOk(false);
    setError(null);
    try {
      const summary = await saveMap(id, { fields });
      setSavedOk(true);
      setDetail((prev) => (prev ? { ...prev, summary } : prev));
      getVersions(id).then(setVersions).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }, [id, fields]);

  if (!detail) {
    return <div className="text-sm text-text-secondary">{error ?? 'Loading…'}</div>;
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between mb-1 gap-3 flex-wrap">
        <div>
          <button onClick={() => navigate('/tools/pdf-overlay')} className="text-sm text-brand-cyan hover:underline">
            ← Templates
          </button>
          <h2 className="text-xl font-bold mt-1">{detail.summary.displayName}</h2>
          <p className="text-xs text-text-muted">
            {detail.summary.allClients ? 'All clients' : detail.summary.clientIds.join(', ')} ·{' '}
            {detail.summary.documentType} · v{detail.summary.currentVersion}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={addField} className="bg-transparent border border-border text-text-primary px-3 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all">
            + Add field
          </button>
          <button onClick={() => preview()} className="bg-transparent border border-border text-text-primary px-3 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all">
            Preview
          </button>
          <button onClick={() => setHistoryOpen(true)} className="bg-transparent border border-border text-text-primary px-3 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all">
            History
          </button>
          <button
            onClick={save}
            disabled={saving || hasIdErrors || hasBindingErrors}
            className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <p className="text-sm text-text-secondary mb-4">
        Drag and resize fields directly on the PDF to map where delivery data is stamped. Save to publish a new version.
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm mb-3">⚠️ {error}</div>}
      {savedOk && <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-3 py-2 text-sm mb-3">Saved as a new version.</div>}
      {hasIdErrors && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-md px-3 py-2 text-sm mb-3">
          Every field needs a unique, non-empty binding key before you can save.
        </div>
      )}
      {!hasIdErrors && hasBindingErrors && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-md px-3 py-2 text-sm mb-3">
          Every field needs a data binding selected before you can save.
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="bg-white border border-border rounded-lg p-2 flex-1 overflow-auto w-full">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-2 py-1 rounded border border-border text-sm disabled:opacity-40"
              aria-label="previous page"
            >
              ‹
            </button>
            <span className="text-sm text-text-secondary">Page {page} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pageCount}
              className="px-2 py-1 rounded border border-border text-sm disabled:opacity-40"
              aria-label="next page"
            >
              ›
            </button>
          </div>
          <FieldMapperCanvas
            data={pdfData}
            pageNumber={page}
            scale={SCALE}
            fields={pageFields}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onGeometryChange={onGeometry}
          />
        </div>

        <div className="bg-white border border-border rounded-lg w-full md:w-80 md:flex-shrink-0">
          <FieldPropertiesPanel
            field={selected}
            onChange={updateField}
            onDelete={deleteField}
            idError={idError}
            bindingError={bindingError}
          />
        </div>
      </div>

      {previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-white rounded-lg w-full max-w-3xl h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-2 border-b border-border">
              <span className="text-sm font-semibold">Preview</span>
              <button onClick={closePreview} className="text-sm text-text-muted hover:text-text-primary">✕</button>
            </div>
            {/* Rendered with pdf.js to a canvas (not an iframe) — avoids Chrome blocking a PDF in a
                sandboxed frame, and renders cleanly under the app CSP. */}
            <div className="flex-1 overflow-hidden">
              <PdfPreview data={previewData} />
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setHistoryOpen(false)}>
          <div className="bg-white rounded-lg w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-1">Version history</h3>
            <p className="text-xs text-text-secondary mb-3">
              Each save publishes a new version. Open one to preview it with sample data.
            </p>
            <ul className="divide-y divide-border">
              {[...versions].sort((a, b) => b - a).map((v) => (
                <li key={v}>
                  <button
                    onClick={() => { setHistoryOpen(false); void preview(v); }}
                    className="w-full flex items-center justify-between py-2 text-sm hover:text-brand-cyan"
                  >
                    <span>Version {v}</span>
                    {v === detail.summary.currentVersion && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-cyan/20 text-brand-cyan">Current</span>
                    )}
                  </button>
                </li>
              ))}
              {versions.length === 0 && <li className="py-2 text-sm text-text-secondary">No versions yet.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
