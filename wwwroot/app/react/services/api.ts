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
} from '../types/configurator';

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
  // 204 No Content (and any other body-less response) → return undefined.
  // Callers that type the response as `unknown` or `void` ignore the value;
  // callers expecting an object would have to opt into a JSON-returning
  // endpoint instead.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
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
  getAll: (group?: string) =>
    request<{ eventTypes: Array<{ id: number; name: string; group: string }> }>(
      '/eventtype' + (group ? `?group=${encodeURIComponent(group)}` : '')
    ),
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
  getClientsByIds: (ids: number[]) =>
    request<{ clients: ClientLookupDto[] }>(`/lookup/clients/by-ids?ids=${ids.join(',')}`),
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

// --- Features (Phase 5+31 R2 §2 — ClientType × Feature visibility matrix) ---
export interface FeatureMatrixClientType { id: number; name: string }
export interface FeatureMatrixFeature {
  featureKey: string;
  displayName: string;
  description: string | null;
  category: string | null;
  // Cascade hierarchy. Backend surfaces these from dbo.Feature once the
  // ParentKey / Tier / SortOrder columns are populated. Optional on the wire so
  // the UI can fall back to flat-by-category rendering when parentKey is absent
  // across the response.
  parentKey?: string | null;
  tier?: number;
  sortOrder?: number;
  // SEED-SCOPE-ALL-HUBS §2 — comma list of ISO country codes the feature is
  // limited to (null/empty = available everywhere). Editable in the matrix.
  availableCountries?: string | null;
}
export interface FeatureMatrixCell {
  clientTypeId: number;
  featureKey: string;
  visible: boolean;
}
export interface FeatureMatrix {
  clientTypes: FeatureMatrixClientType[];
  features: FeatureMatrixFeature[];
  matrix: FeatureMatrixCell[];
}

export const featuresApi = {
  /** Current user's visible feature keys. Available to any authed user. */
  getMyVisibleFeatures: () => request<string[]>('/me/visible-features'),
  /** Full ClientType × Feature matrix for the DF-admin matrix UI. AdminOnly. */
  getMatrix: () => request<FeatureMatrix>('/admin/client-type-features'),
  /** Toggle a single (ClientTypeId, FeatureKey) cell. AdminOnly. */
  setVisibility: (clientTypeId: number, featureKey: string, visible: boolean) =>
    request<unknown>(
      `/admin/client-type-features/${clientTypeId}/${encodeURIComponent(featureKey)}`,
      { method: 'PUT', body: JSON.stringify({ visible }) }
    ),
  /** Set a feature's country scope (comma list of ISO codes, or null = global). AdminOnly. */
  setAvailableCountries: (featureKey: string, availableCountries: string | null) =>
    request<unknown>(
      `/admin/features/${encodeURIComponent(featureKey)}/available-countries`,
      { method: 'PUT', body: JSON.stringify({ availableCountries }) }
    ),
};

// --- Role × Permission matrix (Phase 5+31 R3) ---
export interface RoleRefDto {
  contactRoleId: number;
  name: string;
  description: string | null;
}
export interface PermissionRefDto {
  permissionKey: string;
  displayName: string;
  description: string | null;
  category: string | null;
  // Unified Permissions §4.2 — tree metadata.
  parentKey: string | null;
  tier: number;        // 1 = hub tile, 2 = leaf
  accessType: number;  // max level this node supports (1=View,2=Edit,3=Action)
  sortOrder: number;
}
export interface RolePermissionCellDto {
  contactRoleId: number;
  permissionKey: string;
  allowed: boolean;
  accessLevel: number | null;  // 0=None,1=View,2=Edit,3=Action (null = legacy Allowed)
  clientId: number | null;
}
export interface RolePermissionMatrix {
  roles: RoleRefDto[];
  permissions: PermissionRefDto[];
  matrix: RolePermissionCellDto[];
}

export const rolePermissionsApi = {
  /** Current user's allowed permission keys. Available to any authed user. */
  getMyPermissions: () => request<string[]>('/me/permissions'),
  /** Full Role × Permission matrix for the DF-admin matrix UI. AdminOnly. */
  getMatrix: () => request<RolePermissionMatrix>('/admin/role-permissions'),
  /** Upsert a (ContactRoleId, PermissionKey, ClientId) cell. AdminOnly.
   *  When accessLevel is supplied it is authoritative (server derives Allowed);
   *  clientId = null edits the global default, non-null a per-client override. */
  setPermission: (
    contactRoleId: number,
    permissionKey: string,
    accessLevel: number,
    clientId: number | null = null,
  ) =>
    request<unknown>(
      `/admin/role-permissions/${contactRoleId}/${encodeURIComponent(permissionKey)}`,
      { method: 'PUT', body: JSON.stringify({ allowed: accessLevel >= 1, accessLevel, clientId }) }
    ),
};

// --- Role Management + lookups (Unified Permissions §8.2) ---
export interface RoleListItem {
  contactRoleId: number;
  name: string;
  description: string | null;
  tenantClientId: number | null;
  scopeLabel: string;
  clientTypeIds: number[];
  contactCount: number;
  isActive: boolean;
}
export interface RoleDetail {
  contactRoleId: number;
  name: string;
  description: string | null;
  tenantClientId: number | null;
  clientTypeIds: number[];
  isActive: boolean;
  affectedContactsCount: number;
}
export interface ClientTypeRef { id: number; name: string; }
export interface RelationshipTypeRef { relationshipTypeId: number; name: string; }
export interface ClientRef { id: number; name: string; clientTypeId: number; }
export interface RoleCell {
  permissionKey: string;
  allowed: boolean;
  accessLevel: number | null;
  clientId: number | null;
}
export interface RolePermissionsForRole {
  contactRoleId: number;
  permissions: PermissionRefDto[];
  cells: RoleCell[];
}
export interface CreateRoleBody {
  name: string;
  description?: string | null;
  tenantClientId?: number | null;
  clientTypeIds: number[];
}
export interface UpdateRoleBody {
  name: string;
  description?: string | null;
  isActive: boolean;
  clientTypeIds: number[];
}

export const rolesApi = {
  list: (params?: { scope?: string; clientType?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.scope) q.set('scope', params.scope);
    if (params?.clientType != null) q.set('clientType', String(params.clientType));
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<RoleListItem[]>(`/admin/roles${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => request<RoleDetail>(`/admin/roles/${id}`),
  create: (body: CreateRoleBody) =>
    request<RoleDetail>('/admin/roles', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: UpdateRoleBody) =>
    request<unknown>(`/admin/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deactivate: (id: number) =>
    request<unknown>(`/admin/roles/${id}/deactivate`, { method: 'POST', body: '{}' }),
  getPermissions: (id: number) =>
    request<RolePermissionsForRole>(`/admin/roles/${id}/permissions`),
  clientTypes: () => request<ClientTypeRef[]>('/admin/client-types'),
  relationshipTypes: () => request<RelationshipTypeRef[]>('/admin/relationship-types'),
  /** Active NP/Tenant clients for the matrix per-client override overlay (§8.3.1). */
  clients: () => request<ClientRef[]>('/admin/clients'),
};

// --- DF-Admin multi-lane Team & Users (Unified Permissions §8.1) ---
export interface AdminContactRow {
  id: string; name: string; email: string; clientName: string;
  roles: { id: number; name: string }[]; status: 'active' | 'inactive'; lastLogin: string;
}
export interface AdminContactDetail {
  id: number; firstName: string; lastName: string; email: string; jobTitle: string;
  mobile: string; directDial: string; notes: string; relationshipTypeId: number | null;
  roleIds: number[]; status: 'active' | 'inactive'; clientId: number | null; clientName: string; clientTypeId: number;
  // Only present on the create response — the Hub-identity/invite outcome notice.
  inviteNotice?: string | null;
}
export interface AdminResolvedPerm { key: string; displayName: string; level: number; }
export interface AdminResolvedTile { key: string; displayName: string; level: number; items: AdminResolvedPerm[]; }
export interface AdminContactAudit { changedAt: string; field: string; oldValue: string; newValue: string; changedBy: string; }
export interface AdminRoleOption { id: number; name: string; description: string; }
export interface AdminRelType { id: number; name: string; }
export interface AdminClientOption { id: number; name: string; clientTypeId: number; }
export interface AdminContactSave {
  clientId?: number | null; firstName: string; lastName: string; email: string;
  jobTitle: string; mobile: string; directDial: string; notes: string;
  relationshipTypeId: number | null; roleIds: number[]; status: 'active' | 'inactive';
}
// RESOLVED-DATA-SCOPE §7.3 — DF-admin-only inspector of a contact's effective
// data boundary. Reflects the real ScopeDecider; fields the resolver doesn't
// compute are null and listed in notModelled.
export interface ResolvedDataScope {
  contactId: number; displayName: string;
  resolvedClientTypeId: number; resolvedClientTypeName: string;
  scopeKind: 'Platform' | 'Tenant' | 'Np' | 'Customer' | 'Courier' | 'None';
  summary: string;
  homeClientId: number | null; homeClientName: string | null;
  tenantClientId: number | null; tenantClientName: string | null;
  npAgentId: number | null; npAgentName: string | null;
  customerClientId: number | null; courierId: number | null;
  canSeeDfAdmin: boolean; canCrossTenant: boolean;
  canSeeChildClientsOnly: boolean | null; isInheritedFromParentClient: boolean | null;
  resolutionSource: string; rules: string[]; notModelled: string[];
}

export const contactsApi = {
  list: (lane: string) => request<AdminContactRow[]>(`/admin/contacts?lane=${encodeURIComponent(lane)}`),
  get: (id: number | string) => request<AdminContactDetail>(`/admin/contacts/${id}`),
  permissions: (id: number | string) => request<AdminResolvedTile[]>(`/admin/contacts/${id}/permissions`),
  history: (id: number | string) => request<AdminContactAudit[]>(`/admin/contacts/${id}/history`),
  dataScope: (id: number | string) => request<ResolvedDataScope>(`/admin/contacts/${id}/data-scope`),
  roles: (clientType: number) => request<AdminRoleOption[]>(`/admin/contacts/lookups/roles?clientType=${clientType}`),
  relationshipTypes: () => request<AdminRelType[]>('/admin/contacts/lookups/relationship-types'),
  clients: (lane: string) => request<AdminClientOption[]>(`/admin/contacts/lookups/clients?lane=${encodeURIComponent(lane)}`),
  create: (body: AdminContactSave) => request<AdminContactDetail>('/admin/contacts', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number | string, body: AdminContactSave) => request<AdminContactDetail>(`/admin/contacts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};
