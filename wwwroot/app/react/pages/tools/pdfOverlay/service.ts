// API layer for the PDF Overlay tool — fetch-based to match configurator's services/api.ts
// conventions (X-Requested-With on every call; same-origin cookies). Endpoints are served by
// API/Controllers/Tools/PdfOverlayController.cs under /api/pdf-overlay. The client dropdown reuses
// configurator's existing /api/lookup/clients.

import type { ClientOption, FieldMap, TemplateDetail, TemplateSummary } from './types';

const BASE = '/api/pdf-overlay';
const XHR = { 'X-Requested-With': 'XMLHttpRequest' } as const;

async function fail(res: Response): Promise<never> {
  const text = await res.text().catch(() => '');
  throw new Error(text || `HTTP ${res.status}`);
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const res = await fetch(`${BASE}/templates`, { headers: { ...XHR } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getTemplate(id: string): Promise<TemplateDetail> {
  const res = await fetch(`${BASE}/templates/${id}`, { headers: { ...XHR } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getVersions(id: string): Promise<number[]> {
  const res = await fetch(`${BASE}/templates/${id}/versions`, { headers: { ...XHR } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getOriginal(id: string): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/templates/${id}/original`, { headers: { ...XHR } });
  if (!res.ok) return fail(res);
  return res.arrayBuffer();
}

export async function uploadTemplate(input: {
  file: File;
  clientIds: string[];
  allClients: boolean;
  displayName: string;
  documentType: string;
}): Promise<TemplateSummary> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('clientIds', input.clientIds.join(','));
  form.append('allClients', String(input.allClients));
  form.append('displayName', input.displayName);
  form.append('documentType', input.documentType);
  // No Content-Type header — the browser sets the multipart boundary.
  const res = await fetch(`${BASE}/templates`, { method: 'POST', headers: { ...XHR }, body: form });
  if (!res.ok) return fail(res);
  return res.json();
}

/** Edit a template's details (display name, document type, client scope). Omitted fields are unchanged. */
export async function updateTemplateDetails(
  id: string,
  details: { displayName?: string; documentType?: string; clientIds?: string[]; allClients?: boolean },
): Promise<TemplateSummary> {
  const res = await fetch(`${BASE}/templates/${id}/details`, {
    method: 'PUT',
    headers: { ...XHR, 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function saveMap(id: string, map: FieldMap): Promise<TemplateSummary> {
  const res = await fetch(`${BASE}/templates/${id}/map`, {
    method: 'PUT',
    headers: { ...XHR, 'Content-Type': 'application/json' },
    body: JSON.stringify(map),
  });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function setTemplateActive(id: string, active: boolean): Promise<void> {
  const res = await fetch(`${BASE}/templates/${id}/active`, {
    method: 'PUT',
    headers: { ...XHR, 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
  if (!res.ok) return fail(res);
}

/** Renders the template with placeholder data and returns the PDF bytes (rendered to canvas by PdfPreview). */
export async function renderPreview(
  id: string,
  data: Record<string, unknown>,
  version?: number,
): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/templates/${id}/render`, {
    method: 'POST',
    headers: { ...XHR, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, bindingMode: 'id', version }),
  });
  if (!res.ok) return fail(res);
  return res.arrayBuffer();
}

/** Active clients for the current tenant — reuses configurator's shared lookup endpoint. */
export async function listClients(): Promise<ClientOption[]> {
  const res = await fetch('/api/lookup/clients', { headers: { ...XHR } });
  if (!res.ok) return fail(res);
  const body = (await res.json()) as { clients: ClientOption[] };
  return body.clients ?? [];
}
