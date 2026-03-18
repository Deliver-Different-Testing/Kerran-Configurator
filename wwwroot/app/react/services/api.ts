// ============================================================================
// API service layer - wraps fetch calls to the backend
// ============================================================================

import type {
  AppConfigDto,
  WorkflowTemplateDto,
  WorkflowTemplateCreateRequest,
  WorkflowLookupsResponse,
  ClientLookupDto,
  ServiceLookupDto,
} from '../types';

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // Required by CSRF middleware
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.messages?.[0]?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- AppConfig ---
export const appConfigApi = {
  getAll: () => request<{ configs: AppConfigDto[] }>('/appconfig'),
  get: (id: number) => request<{ config: AppConfigDto }>(`/appconfig/${id}`),
  search: (category?: string, searchText?: string) =>
    request<{ configs: AppConfigDto[] }>('/appconfig/Search', {
      method: 'POST',
      body: JSON.stringify({ category, searchText }),
    }),
  create: (data: Partial<AppConfigDto>) =>
    request<{ config: AppConfigDto }>('/appconfig', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<AppConfigDto>) =>
    request<{ config: AppConfigDto }>(`/appconfig/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/appconfig/${id}`, { method: 'DELETE' }),
};

// --- WorkflowTemplate ---
export const workflowApi = {
  getAll: () => request<{ templates: WorkflowTemplateDto[] }>('/workflowtemplate'),
  get: (id: number) => request<{ template: WorkflowTemplateDto }>(`/workflowtemplate/${id}`),
  search: (searchText?: string) =>
    request<{ templates: WorkflowTemplateDto[] }>('/workflowtemplate/Search', {
      method: 'POST',
      body: JSON.stringify({ searchText }),
    }),
  getLookups: () => request<WorkflowLookupsResponse>('/workflowtemplate/lookups'),
  create: (data: WorkflowTemplateCreateRequest) =>
    request<{ template: WorkflowTemplateDto }>('/workflowtemplate', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: WorkflowTemplateCreateRequest) =>
    request<{ template: WorkflowTemplateDto }>(`/workflowtemplate/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/workflowtemplate/${id}`, { method: 'DELETE' }),
};

// --- EventType ---
export const eventTypeApi = {
  getAll: () => request<{ eventTypes: Array<{ id: number; name: string; group: string }> }>('/eventtype'),
  search: (searchText?: string) =>
    request<{ eventTypes: Array<{ id: number; name: string; group: string }> }>('/eventtype/Search', {
      method: 'POST',
      body: JSON.stringify({ searchText }),
    }),
  getEventTypeGroups: (eventTypeId: number) =>
    request<{ mappings: Array<{ id: number; eventTypeId: number; eventTypeGroupId: number; sequence: number; isActive: boolean }> }>(`/eventtype/${eventTypeId}/eventTypeGroups`),
  getByGroup: (groupName: string) =>
    request<{ mappings: Array<{ id: number; eventTypeId: number; eventTypeGroupId: number; eventTypeName: string; groupName: string; sequence: number; isActive: boolean; kind: string; url: string | null; displayName: string | null; description: string | null; icon: string | null; color: string | null }> }>(`/eventtype/group/${encodeURIComponent(groupName)}`),
  addEventTypeGroup: (eventTypeId: number, data: { eventTypeGroupId: number; sequence?: number; kind?: string; url?: string; displayName?: string; description?: string; icon?: string; color?: string }) =>
    request<{ mapping: { id: number } }>(`/eventtype/${eventTypeId}/eventTypeGroups`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteEventTypeGroup: (eventTypeId: number, mappingId: number) =>
    request<{ success: boolean }>(`/eventtype/${eventTypeId}/eventTypeGroups/${mappingId}`, {
      method: 'DELETE',
    }),
};

// --- Lookup ---
export const lookupApi = {
  getClients: () => request<{ clients: ClientLookupDto[] }>('/lookup/clients'),
  getServices: () => request<{ services: ServiceLookupDto[] }>('/lookup/services'),
  getSites: () => request<{ sites: Array<{ id: number; name: string }> }>('/lookup/sites'),
  getRegions: () => request<{ regions: Array<{ id: number; name: string }> }>('/lookup/regions'),
  searchClients: (q?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (limit) params.set('limit', String(limit));
    return request<{ clients: ClientLookupDto[] }>(`/lookup/clients?${params}`);
  },
  searchServices: (q?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (limit) params.set('limit', String(limit));
    return request<{ services: ServiceLookupDto[] }>(`/lookup/services?${params}`);
  },
};

// --- MobileConfig ---
export const mobileApi = {
  getConfig: () => request<Record<string, unknown>>('/mobile/config'),
  getWorkflow: (jobId: number) => request<Record<string, unknown>>(`/mobile/workflow?jobId=${jobId}`),
};
