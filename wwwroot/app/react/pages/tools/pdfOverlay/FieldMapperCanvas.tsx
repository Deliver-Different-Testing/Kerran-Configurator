import { memo, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Canvas as FabricCanvas, FabricImage, FabricText, Rect } from 'fabric';
import type { FieldMapping } from './types';
import { pixelsToPoints, pointsToPixels } from './fieldGeometry';

// Vite resolves the worker URL at build time.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export interface FieldMapperCanvasProps {
  data: ArrayBuffer | undefined;
  pageNumber: number;
  scale: number;
  fields: FieldMapping[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onGeometryChange: (id: string, geom: Pick<FieldMapping, 'x' | 'y' | 'w' | 'h'>) => void;
}

function FieldMapperCanvas(props: FieldMapperCanvasProps) {
  const { data, pageNumber, scale, fields, selectedId, onSelect, onGeometryChange } = props;
  const fabricElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const rectToId = useRef(new WeakMap<object, string>());
  // Set while we rebuild rects programmatically so the resulting selection events don't feed back into
  // state (removing objects fires selection:cleared, which would otherwise clear the active field).
  const suppressEvents = useRef(false);
  // The parsed document is rendered on demand; holding it lets page/scale changes re-render a page
  // without re-parsing the whole file.
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  // The fabric handlers below are registered once but must see the current props/scale; reading them
  // through a ref kept fresh each render avoids stale closures if scale ever becomes dynamic or a
  // non-stable callback is passed.
  const latest = useRef({ onSelect, onGeometryChange, scale });
  latest.current = { onSelect, onGeometryChange, scale };

  // Parse the PDF once per document (not per page turn / zoom). The loading task's destroy() tears down
  // both the task and the resolved document, freeing its worker resources when data changes or we unmount.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const task = pdfjsLib.getDocument({ data: data.slice(0) });
    task.promise.then(
      (pdf) => {
        if (!cancelled) setPdfDoc(pdf);
      },
      () => {}, // load aborted (destroy() below) — rejection is expected, swallow it
    );
    return () => {
      cancelled = true;
      setPdfDoc(null);
      void task.destroy();
    };
  }, [data]);

  // Initialise the fabric canvas once. The PDF page is drawn as this canvas's BACKGROUND IMAGE (below),
  // so the page and the field rects share ONE coordinate system — they can't drift apart (the previous
  // two-overlaid-canvases approach left a constant horizontal offset between the page and the boxes).
  useEffect(() => {
    if (!fabricElRef.current) return;
    // enableRetinaScaling:false — Fabric's retina (×devicePixelRatio) backing store was leaking into
    // the pointer→coordinate mapping, so a box dropped at a visual position stored a coordinate
    // devicePixelRatio× too large. Disabling it keeps backing = display = coordinate space, all at
    // logical size (we render the PDF background ourselves, so we don't need Fabric's hi-dpi handling).
    const fabric = new FabricCanvas(fabricElRef.current, {
      selection: true,
      preserveObjectStacking: true,
      enableRetinaScaling: false,
    });
    fabricRef.current = fabric;

    fabric.on('selection:created', (e) => {
      if (suppressEvents.current) return;
      latest.current.onSelect(rectToId.current.get(e.selected?.[0] as object) ?? null);
    });
    fabric.on('selection:updated', (e) => {
      if (suppressEvents.current) return;
      latest.current.onSelect(rectToId.current.get(e.selected?.[0] as object) ?? null);
    });
    fabric.on('selection:cleared', () => {
      if (suppressEvents.current) return;
      latest.current.onSelect(null);
    });
    fabric.on('object:modified', (e) => {
      const target = e.target;
      if (!target) return;
      const id = rectToId.current.get(target);
      if (!id) return;
      latest.current.onGeometryChange(id, pixelsToPoints({
        left: target.left ?? 0,
        top: target.top ?? 0,
        width: (target.width ?? 0) * (target.scaleX ?? 1),
        height: (target.height ?? 0) * (target.scaleY ?? 1),
      }, latest.current.scale));
    });

    return () => {
      void fabric.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render the current page into an offscreen canvas, then set it as the fabric canvas's background.
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!pdfDoc || !fabric) return;

    let cancelled = false;
    let task: RenderTask | null = null;

    pdfDoc.getPage(pageNumber)
      .then((page) => {
        if (cancelled) return null;
        // LOGICAL page size (point × scale) — this is the coordinate space the field rects use.
        const viewport = page.getViewport({ scale });
        const off = document.createElement('canvas');
        off.width = Math.floor(viewport.width);
        off.height = Math.floor(viewport.height);
        task = page.render({ canvas: off, viewport });
        return task.promise.then(() => ({ off, logicalW: viewport.width, logicalH: viewport.height }));
      })
      .then((res) => {
        if (cancelled || !res) return;
        const { off, logicalW, logicalH } = res;
        // pdf.js renders into `off` at DEVICE pixels — it multiplies by devicePixelRatio (OS display
        // scaling × browser zoom), so off.width can be 2–3× the logical width. Scale the page image
        // back down to the logical size so it lines up with the fabric coordinate space the boxes use.
        // (This was the bug: the page was DPR× bigger than the box coordinates, so a box dropped on a
        // line stored a coordinate DPR× too large.)
        const factor = logicalW / off.width;
        fabric.setDimensions({ width: logicalW, height: logicalH });
        fabric.backgroundImage = new FabricImage(off, {
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
          scaleX: factor,
          scaleY: factor,
          selectable: false,
          evented: false,
        });
        fabric.renderAll();
      })
      .catch((err: unknown) => {
        // Cancelling an in-flight render (rapid page-flip / zoom) rejects with RenderingCancelledException
        // — expected, swallow it. Anything else is a real failure worth surfacing.
        if (!(err as { name?: string })?.name?.includes('RenderingCancelled')) {
          console.error('PDF page render failed', err);
        }
      });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdfDoc, pageNumber, scale]);

  // Sync the rectangles to the current page's fields.
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;

    suppressEvents.current = true;
    fabric.remove(...fabric.getObjects());
    const map = rectToId.current;
    let activeRect: Rect | null = null;

    for (const field of fields) {
      const px = pointsToPixels(field, scale);
      const rect = new Rect({
        left: px.left,
        top: px.top,
        width: px.width,
        height: px.height,
        // Fabric v6 defaults originX/originY to 'center'; pin to the top-left so `left`/`top` are the
        // box's TOP-LEFT corner — which is what the renderer (and field.x/y) treat as the anchor.
        originX: 'left',
        originY: 'top',
        fill: 'rgba(33,150,243,0.12)',
        stroke: field.id === selectedId ? '#1976d2' : '#90caf9',
        strokeWidth: field.id === selectedId ? 2 : 1,
        cornerColor: '#1976d2',
        transparentCorners: false,
      });
      map.set(rect, field.id);
      fabric.add(rect);

      // A small identifier tag pinned to the rect's top-left so the user can tell fields apart while
      // placing them. Non-interactive (the rect underneath stays the selectable/movable object); we
      // reposition it on drag/resize since it isn't grouped with the rect. An absolute-positioned
      // clipPath confines the caption to the field box so a long name can't spill past the edges.
      const caption = field.label?.trim() || field.dataBinding || field.id;
      const clip = new Rect({ left: px.left, top: px.top, width: px.width, height: px.height, originX: 'left', originY: 'top', absolutePositioned: true });
      const tag = new FabricText(caption, {
        left: px.left + 2,
        top: px.top + 2,
        originX: 'left',
        originY: 'top',
        fontSize: 11,
        fontFamily: 'sans-serif',
        fill: '#fff',
        backgroundColor: field.id === selectedId ? '#1976d2' : '#90caf9',
        selectable: false,
        evented: false,
        clipPath: clip,
      });
      const pinTag = () => {
        const left = rect.left ?? 0;
        const top = rect.top ?? 0;
        tag.set({ left: left + 2, top: top + 2 });
        clip.set({ left, top, width: (rect.width ?? 0) * (rect.scaleX ?? 1), height: (rect.height ?? 0) * (rect.scaleY ?? 1) });
      };
      rect.on('moving', pinTag);
      rect.on('scaling', pinTag);
      fabric.add(tag);

      if (field.id === selectedId) activeRect = rect;
    }

    // Re-apply the active object so the selected field keeps its handles after a rebuild (e.g. right
    // after a drag, where object:modified updated `fields` and tore down the rect being manipulated).
    if (activeRect) fabric.setActiveObject(activeRect);
    else fabric.discardActiveObject();
    fabric.renderAll();
    suppressEvents.current = false;
  }, [fields, selectedId, scale]);

  return (
    <div style={{ display: 'inline-block', lineHeight: 0 }}>
      <canvas ref={fabricElRef} />
    </div>
  );
}

// Memoised: the parent recreates its callbacks each render, but they're stabilised with useCallback and
// the heavy fabric/PDF work is gated behind the effects above, so re-renders should be prop-driven only.
export default memo(FieldMapperCanvas);
