// Ported verbatim from pdf-overlay-tool (src/lib/fieldGeometry.ts).
import type { FieldMapping } from './types';

/** A rectangle in canvas pixels. */
export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Field coordinates are PDF points with a top-left origin (the renderer's contract). The canvas renders
 * the page at `scale` pixels-per-point, so the conversion both ways is a simple multiply/divide — no
 * y-flip here (the renderer handles PDF's bottom-left origin internally).
 */
export function pointsToPixels(field: FieldMapping, scale: number): PixelRect {
  return {
    left: field.x * scale,
    top: field.y * scale,
    width: field.w * scale,
    height: field.h * scale,
  };
}

export function pixelsToPoints(rect: PixelRect, scale: number): Pick<FieldMapping, 'x' | 'y' | 'w' | 'h'> {
  return {
    x: round(rect.left / scale),
    y: round(rect.top / scale),
    w: round(rect.width / scale),
    h: round(rect.height / scale),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
