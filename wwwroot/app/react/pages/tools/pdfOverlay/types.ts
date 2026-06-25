// Ported from the standalone pdf-overlay-tool AdminPortal (src/api/types.ts).
// Mirrors the backend PdfOverlay field-map contract (camelCase + string enums).

export type FieldType = 'text' | 'multiline' | 'date' | 'image' | 'barcode';
export type TextAlignment = 'left' | 'center' | 'right';

/** Mirrors Core.PdfOverlay.FieldMapping (coordinates in PDF points, top-left origin). */
export interface FieldMapping {
  id: string;
  label?: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: FieldType;
  dataBinding?: string;
  fontSize: number;
  fontFamily: string;
  alignment: TextAlignment;
  format?: string;
  acroField?: string;
}

export interface FieldMap {
  fields: FieldMapping[];
}

export interface TemplateSummary {
  templateId: string;
  /** Client codes this template applies to. Empty when allClients is true. */
  clientIds: string[];
  /** True when the template applies to every client (clientIds is then ignored). */
  allClients: boolean;
  displayName: string;
  documentType: string;
  currentVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail {
  summary: TemplateSummary;
  map: FieldMap;
  pageCount: number;
}

/** Reused from configurator's /api/lookup/clients (ClientLookupDto). */
export interface ClientOption {
  id: number;
  code: string;
  name: string;
}

export function newField(id: string, page: number): FieldMapping {
  return {
    id,
    label: id,
    page,
    x: 72,
    y: 72,
    w: 200,
    h: 18,
    type: 'text',
    fontSize: 10,
    fontFamily: 'Helvetica',
    alignment: 'left',
  };
}
