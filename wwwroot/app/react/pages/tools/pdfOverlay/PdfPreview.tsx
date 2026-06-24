import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Renders rendered-PDF bytes to stacked canvases via pdf.js — used for the editor Preview/History
// instead of an <iframe src="blob:…">, which recent Chrome blocks inside a sandboxed frame (its
// built-in PDF viewer won't run there). This shares the same pdf.js path the field-mapper uses, so it
// works cleanly under the app CSP.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export default function PdfPreview({ data }: { data: ArrayBuffer }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    container.replaceChildren();
    const task = pdfjsLib.getDocument({ data: data.slice(0) });

    task.promise.then(
      async (pdf) => {
        for (let n = 1; n <= pdf.numPages; n += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.maxWidth = `${Math.floor(viewport.width)}px`;
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 10px';
          canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)';
          if (cancelled) return;
          container.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
      },
      () => {}, // load aborted (destroy below) — expected
    ).catch((err: unknown) => {
      if (!(err as { name?: string })?.name?.includes('RenderingCancelled')) {
        console.error('PDF preview render failed', err);
      }
    });

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [data]);

  return <div ref={containerRef} style={{ overflow: 'auto', height: '100%', padding: 8, background: '#f5f5f4' }} />;
}
