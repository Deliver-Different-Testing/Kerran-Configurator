// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.

export interface Fleet {
  id: number;
  name: string;
  depotId: number | null;
  directCostAccountCode: string;
  notes: string;
  displayOnClearlistsDespatch: boolean;
  displayOnClearlistsDevice: boolean;
  allowCourierPortalAccess: boolean;
  allowInvoicing: boolean;
  allowSchedules: boolean;
  created: string;
  createdBy: string;
  lastModified: string;
  lastModifiedBy: string;
}

export interface FleetCourier {
  id: number;
  name: string;
  phone: string;
  status: 'active' | 'inactive';
  vehicle: string;
}

export interface Depot {
  id: number;
  name: string;
}

const mockFleets: Fleet[] = [
  {
    id: 1, name: 'Chicago Downtown', depotId: 1, directCostAccountCode: '5100',
    notes: 'Primary downtown fleet', displayOnClearlistsDespatch: true, displayOnClearlistsDevice: true,
    allowCourierPortalAccess: true, allowInvoicing: true, allowSchedules: true,
    created: '2024-01-15', createdBy: 'Admin', lastModified: '2026-02-20', lastModifiedBy: 'J. Harper',
  },
  {
    id: 2, name: 'Dallas Metro', depotId: 2, directCostAccountCode: '5200',
    notes: 'Dallas / Fort Worth area', displayOnClearlistsDespatch: true, displayOnClearlistsDevice: true,
    allowCourierPortalAccess: true, allowInvoicing: true, allowSchedules: true,
    created: '2024-01-15', createdBy: 'Admin', lastModified: '2026-01-30', lastModifiedBy: 'Admin',
  },
  {
    id: 3, name: 'Houston Central', depotId: 3, directCostAccountCode: '5300',
    notes: 'Houston Midtown + Galleria', displayOnClearlistsDespatch: true, displayOnClearlistsDevice: false,
    allowCourierPortalAccess: true, allowInvoicing: false, allowSchedules: true,
    created: '2024-03-01', createdBy: 'Admin', lastModified: '2026-02-15', lastModifiedBy: 'J. Harper',
  },
];

const mockDepots: Depot[] = [
  { id: 1, name: 'Chicago Depot' },
  { id: 2, name: 'Dallas Depot' },
  { id: 3, name: 'Houston Depot' },
];

export const fleetService = {
  getAll(): Fleet[] {
    return mockFleets;
  },

  search(query: string): Fleet[] {
    const q = query.trim().toLowerCase();
    if (!q) return mockFleets;
    return mockFleets.filter(f => f.name.toLowerCase().includes(q));
  },

  getById(id: number): Fleet | undefined {
    return mockFleets.find(f => f.id === id);
  },

  create(_data: Omit<Fleet, 'id' | 'created' | 'createdBy' | 'lastModified' | 'lastModifiedBy'>): Fleet {
    throw new Error('create() not yet wired to backend');
  },

  update(_id: number, _updates: Partial<Fleet>): Fleet | undefined {
    return undefined;
  },

  delete(_id: number): boolean {
    return false;
  },

  getCouriers(_fleetId: number): FleetCourier[] {
    return [];
  },

  assignCourier(_fleetId: number, _courierId: number): void {
    /* no-op stub */
  },

  getDepots(): Depot[] {
    return mockDepots;
  },

  getDepotName(depotId: number | null, depots?: Depot[]): string {
    if (!depotId) return '—';
    // Some callers don't pass the depots list — fall back to the in-service mock so we don't crash.
    const list = depots ?? mockDepots;
    return list.find(d => d.id === depotId)?.name || '—';
  },
};
