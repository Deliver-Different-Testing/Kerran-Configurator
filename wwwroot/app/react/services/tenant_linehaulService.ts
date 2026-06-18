import api from './tenant_api';
import type { AssignTargetType } from './tenant_routeService';

// Linehaul (depot-to-depot middle-mile) runs — backs the Linehaul tab on the
// tenant Recurring Routes page (spec §3). Native configurator API at
// /api/v1/tenant/linehaul-runs (no DespatchWeb / ClientManager hops).

export interface TenantLinehaulRun {
  id: number;
  runName: string;
  fromDepotId: number;
  toDepotId: number;
  fromDepotName: string;
  toDepotName: string;
  startTime: string | null;       // "HH:mm"
  despatchTime: string | null;    // "HH:mm"
  courierId: number | null;       // null = unbound (courier back-compat)
  defaultDriverName: string | null;
  // Fixes §5 — polymorphic default target (Courier/Agent/NP).
  defaultAgentId: number | null;
  defaultTargetType: AssignTargetType | null;
  defaultTargetId: number | null;
  defaultTargetName: string | null;
  defaultTargetHint: string | null;
  mappedStopsCount: number;
  usedBySchedulesCount: number;
  active: boolean;                // derived: >=1 active schedule binding
}

export interface TenantLinehaulRunUpsert {
  runName: string;
  fromDepotId: number;
  toDepotId: number;
  startTime: string | null;       // "HH:mm"
  despatchTime: string | null;    // "HH:mm"
  // Fixes §5 — polymorphic default target (replaces courierId). null = unbound.
  defaultTargetType: AssignTargetType | null;
  defaultTargetId: number | null;
}

export interface DepotLookup {
  id: number;
  name: string;
}

export interface LinehaulCourierLookup {
  id: number;
  name: string;
  code: string;
}

export interface LinehaulLookups {
  depots: DepotLookup[];
  couriers: LinehaulCourierLookup[];
}

// Surfaces the API's `{ message }` body (validation 400 / blocked-delete 409)
// so the UI can show the server's reason instead of a generic failure.
export function extractLinehaulError(e: unknown, fallback: string): string {
  const res = (e as { response?: { data?: { message?: string } } })?.response;
  return res?.data?.message ?? (e as Error)?.message ?? fallback;
}

// ── Linehaul Roster (spec §4) — Run × Day driver grid ──────────────────

export interface LinehaulRosterCell {
  rosterId: number;
  dayOfWeek: number;            // 1 = Mon .. 7 = Sun
  courierId: number | null;     // courier back-compat / driver filter
  courierName: string | null;
  // Fixes §6 — polymorphic target (Courier/Agent/NP).
  targetType: AssignTargetType | null;
  targetId: number | null;
  targetName: string | null;
  targetHint: string | null;
}

export interface LinehaulRosterRow {
  runId: number;
  runName: string;
  fromDepotName: string;
  toDepotName: string;
  defaultCourierId: number | null;
  defaultDriverName: string | null;
  // Fixes §6 — run's default target (whichever type); cells pre-fill from this.
  defaultTargetType: AssignTargetType | null;
  defaultTargetId: number | null;
  defaultTargetName: string | null;
  defaultTargetHint: string | null;
  active: boolean;
  cells: LinehaulRosterCell[];
}

export interface LinehaulRosterGrid {
  rows: LinehaulRosterRow[];
  couriers: LinehaulCourierLookup[];
}

export interface LinehaulRosterUpsert {
  linehaulRunId: number;
  dayOfWeek: number;            // 1 = Mon .. 7 = Sun
  // Fixes §6 — polymorphic target (replaces courierId).
  targetType: AssignTargetType;
  targetId: number;
}

export const linehaulService = {
  async list(): Promise<TenantLinehaulRun[]> {
    const { data } = await api.get<TenantLinehaulRun[]>('/linehaul-runs');
    return data;
  },
  async lookups(): Promise<LinehaulLookups> {
    const { data } = await api.get<LinehaulLookups>('/linehaul-runs/lookups');
    return data;
  },
  async create(payload: TenantLinehaulRunUpsert): Promise<TenantLinehaulRun> {
    const { data } = await api.post<TenantLinehaulRun>('/linehaul-runs', payload);
    return data;
  },
  async update(id: number, payload: TenantLinehaulRunUpsert): Promise<TenantLinehaulRun> {
    const { data } = await api.put<TenantLinehaulRun>(`/linehaul-runs/${id}`, payload);
    return data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/linehaul-runs/${id}`);
  },
  async copy(id: number): Promise<TenantLinehaulRun> {
    const { data } = await api.post<TenantLinehaulRun>(`/linehaul-runs/${id}/copy`, {});
    return data;
  },

  // Roster grid
  async rosterGrid(): Promise<LinehaulRosterGrid> {
    const { data } = await api.get<LinehaulRosterGrid>('/linehaul-rosters');
    return data;
  },
  async upsertRosterCell(payload: LinehaulRosterUpsert): Promise<LinehaulRosterCell> {
    const { data } = await api.put<LinehaulRosterCell>('/linehaul-rosters', payload);
    return data;
  },
  async deleteRosterCell(rosterId: number): Promise<void> {
    await api.delete(`/linehaul-rosters/${rosterId}`);
  },
};
