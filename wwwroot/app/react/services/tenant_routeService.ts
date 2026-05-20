import api from './tenant_api';

// Backend shapes — kept in sync with TenantRouteDtos.cs.

export interface RouteZipcode {
  zipPolygonId: number;
  zip: string;
}

export interface TenantRoute {
  id: number;
  name: string;
  area: string;
  defaultCourierId: number | null;
  defaultCourierName: string;
  defaultCourierCode: string;
  active: boolean;
  zipcodes: RouteZipcode[];
  rosterEntryCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface RouteUpsert {
  name: string;
  area: string;
  defaultCourierId: number | null;
  active: boolean;
  zipPolygonIds: number[];
}

export interface RosterEntry {
  id: number;
  routeId: number;
  courierId: number;
  courierName: string;
  courierCode: string;
  rosterDate: string | null;   // ISO date when date-specific
  dayOfWeek: number | null;    // 0 = Sun .. 6 = Sat for weekly pattern
  isActive: boolean;
  createdAt: string;
}

export interface RosterUpsert {
  courierId: number;
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
};
