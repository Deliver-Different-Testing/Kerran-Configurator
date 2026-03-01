// ============================================================================
// API service layer - wraps fetch calls to the backend
// ============================================================================

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
  getAll: () => request<any>('/appconfig'),
  get: (id: number) => request<any>(`/appconfig/${id}`),
  search: (category?: string, searchText?: string) =>
    request<any>('/appconfig/Search', {
      method: 'POST',
      body: JSON.stringify({ category, searchText }),
    }),
  create: (data: any) =>
    request<any>('/appconfig', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`/appconfig/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<any>(`/appconfig/${id}`, { method: 'DELETE' }),
};

// --- WorkflowTemplate ---
export const workflowApi = {
  getAll: () => request<any>('/workflowtemplate'),
  get: (id: number) => request<any>(`/workflowtemplate/${id}`),
  search: (searchText?: string) =>
    request<any>('/workflowtemplate/Search', {
      method: 'POST',
      body: JSON.stringify({ searchText }),
    }),
  getLookups: () => request<any>('/workflowtemplate/lookups'),
  create: (data: any) =>
    request<any>('/workflowtemplate', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`/workflowtemplate/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<any>(`/workflowtemplate/${id}`, { method: 'DELETE' }),
  parseNlp: (instruction: string) =>
    request<any>('/workflowtemplate/nlp/parse', {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),
};

// --- EventType (reuse existing) ---
export const eventTypeApi = {
  getAll: () => request<any>('/eventtype'),
  search: (searchText?: string) =>
    request<any>('/eventtype/Search', {
      method: 'POST',
      body: JSON.stringify({ searchText }),
    }),
  getEventTypeGroups: (eventTypeId: number) =>
    request<any>(`/eventtype/${eventTypeId}/eventTypeGroups`),
  addEventTypeGroup: (eventTypeId: number, data: any) =>
    request<any>(`/eventtype/${eventTypeId}/eventTypeGroups`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteEventTypeGroup: (eventTypeId: number, mappingId: number) =>
    request<any>(`/eventtype/${eventTypeId}/eventTypeGroups/${mappingId}`, {
      method: 'DELETE',
    }),
};

// --- MobileConfig ---
export const mobileApi = {
  getConfig: () => request<any>('/mobile/config'),
  getWorkflow: (jobId: number) => request<any>(`/mobile/workflow?jobId=${jobId}`),
};
