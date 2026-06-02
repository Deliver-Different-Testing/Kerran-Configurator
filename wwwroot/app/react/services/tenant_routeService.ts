import api from './tenant_api';

// Backend shapes — kept in sync with TenantRouteDtos.cs.

export interface RouteZipcode {
  zipPolygonId: number;
  zip: string;
}

export type AssignTargetType = 'Courier' | 'Agent' | 'NetworkPartner';

export interface TenantRoute {
  id: number;
  name: string;
  area: string;
  defaultCourierId: number | null;
  defaultCourierName: string;
  defaultCourierCode: string;
  // Unified default target (Courier / Agent / NP). defaultCourierId is kept
  // for the roster's courier-only fallback path.
  defaultAgentId: number | null;
  defaultTargetType: AssignTargetType | null;
  defaultTargetId: number | null;
  defaultTargetName: string;
  defaultTargetHint: string;
  // Bound logical schedule (resolved). scheduleId null = unbound.
  scheduleId: number | null;
  scheduleName: string;
  scheduleStartTime: string;   // "HH:mm"
  scheduleEndTime: string;     // "HH:mm"
  scheduleDays: number[];      // ISO 1=Mon … 7=Sun
  active: boolean;
  zipcodes: RouteZipcode[];
  rosterEntryCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface RouteUpsert {
  name: string;
  area: string;
  defaultTargetType: AssignTargetType | null;
  defaultTargetId: number | null;
  scheduleId: number | null;
  active: boolean;
  zipPolygonIds: number[];
}

// Copy a route's geometry + default target into a new route. No roster copy,
// no booking re-stamp. ScheduleId is deferred until Route→Schedule binding lands.
export interface RouteCopy {
  name: string;
  defaultTargetType: AssignTargetType | null;
  defaultTargetId: number | null;
  scheduleId: number | null;
  copyZipcodes: boolean;
}

export interface AssignTarget {
  id: number;
  name: string;
  hint: string;
}

export interface AssignableTargets {
  couriers: AssignTarget[];
  agents: AssignTarget[];
  nps: AssignTarget[];
}

export interface RosterEntry {
  id: number;
  routeId: number;
  // Courier fields kept for the prebook courier-only path; null/empty for
  // Agent/NP rows.
  courierId: number | null;
  courierName: string;
  courierCode: string;
  // Unified target (Courier / Agent / NP) — feeds the AssignTargetPicker.
  targetType: AssignTargetType | null;
  targetId: number | null;
  targetName: string;
  targetHint: string;
  rosterDate: string | null;   // ISO date when date-specific
  dayOfWeek: number | null;    // 0 = Sun .. 6 = Sat for weekly pattern
  isActive: boolean;
  createdAt: string;
}

export interface RosterUpsert {
  targetType: AssignTargetType | null;
  targetId: number | null;
  rosterDate: string | null;
  dayOfWeek: number | null;
}

export interface ZipcodeLookup {
  zipPolygonId: number;
  zip: string;
}

export interface CourierLookup {
  id: number;
  name: string;
  code: string;
}

// One logical Client Manager schedule for the Route→Schedule binding picker.
// id = representative BulkRunScheduleId. days are ISO-8601 (1=Mon … 7=Sun).
export interface ScheduleLookup {
  id: number;
  name: string;
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  days: number[];
  clientId: number | null;
}

export const routeService = {
  async listRoutes(): Promise<TenantRoute[]> {
    const { data } = await api.get<TenantRoute[]>('/routes');
    return data;
  },
  async createRoute(dto: RouteUpsert): Promise<TenantRoute> {
    const { data } = await api.post<TenantRoute>('/routes', dto);
    return data;
  },
  async updateRoute(id: number, dto: RouteUpsert): Promise<TenantRoute> {
    const { data } = await api.put<TenantRoute>(`/routes/${id}`, dto);
    return data;
  },
  async softDeleteRoute(id: number): Promise<TenantRoute> {
    const { data } = await api.delete<TenantRoute>(`/routes/${id}`);
    return data;
  },
  async copyRoute(sourceRouteId: number, dto: RouteCopy): Promise<TenantRoute> {
    const { data } = await api.post<TenantRoute>(`/routes/${sourceRouteId}/copy`, dto);
    return data;
  },
  async listRoster(routeId: number): Promise<RosterEntry[]> {
    const { data } = await api.get<RosterEntry[]>(`/routes/${routeId}/roster`);
    return data;
  },
  async createRosterEntry(routeId: number, dto: RosterUpsert): Promise<RosterEntry> {
    const { data } = await api.post<RosterEntry>(`/routes/${routeId}/roster`, dto);
    return data;
  },
  async deleteRosterEntry(routeId: number, rosterId: number): Promise<void> {
    await api.delete(`/routes/${routeId}/roster/${rosterId}`);
  },
  async searchZipcodes(q: string): Promise<ZipcodeLookup[]> {
    const { data } = await api.get<ZipcodeLookup[]>('/zipcodes/search', { params: { q } });
    return data;
  },
  async listCouriers(): Promise<CourierLookup[]> {
    const { data } = await api.get<CourierLookup[]>('/couriers/lookup');
    return data;
  },
  async getAssignableTargets(): Promise<AssignableTargets> {
    const { data } = await api.get<AssignableTargets>('/routes/assignable-targets');
    return data;
  },
  async listSchedules(): Promise<ScheduleLookup[]> {
    const { data } = await api.get<ScheduleLookup[]>('/routes/schedules/lookup');
    return data;
  },
};
