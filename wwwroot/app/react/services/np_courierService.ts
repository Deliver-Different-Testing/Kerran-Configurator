// Phase 5+2: live couriers from /api/v1/np/fleet, with safe defaults at the
// mapping layer for the rich Courier-shape fields (compliance/location/etc.)
// the existing pages expect but the lean backend doesn't yet populate.
import api from './np_api';
import type { Courier } from '@/types';

interface NpFleetCourierApi {
  id: number;
  code: string;
  masterCourierId: number | null;
  courierTypeId: number;          // 1 Independent, 2 Master, 3 Sub, 4 Gig
  npAgentId?: number | null;      // NP assignment (null = Direct)
  npAgentName?: string;           // joined display label
  paymentMethod?: string;         // 'Direct' | 'Invoice' | 'None'

  firstName: string;
  surName: string;
  email: string;
  phone: string;
  mobile: string;
  homePhone: string;
  gender: boolean | null;
  dob: string | null;
  address: string;
  doctor: string;
  doctorPhone: string;
  nextOfKin: string;
  nokRelationship: string;
  nokAddress: string;
  nokPhone: string;
  startDate: string | null;
  finishDate: string | null;
  active: boolean;

  vehicle: string;
  makeId: number | null;
  make: string;
  model: string;
  year: number | null;
  rego: string;
  lowEmission: boolean;
  maxPallets: number | null;
  tareWeight: number | null;
  maxCarry: number | null;
  rucWeight: number | null;
  rucKms: number | null;
  rucPayload: number | null;
  height: number | null;
  width: number | null;
  length: number | null;
  inspectionExpiry: string | null;
  regoExpiry: string | null;

  dlNo: string;
  dlExpiry: string | null;
  dangerousGoods: boolean;
  dgExpiry: string | null;
  hte: boolean;
  tslNo: string;

  policyNo: string;
  insuranceCoId: number | null;
  insuranceCo: string;
  carrierLiabId: number | null;
  carrierLiabCompany: string;
  publicLiabId: number | null;
  publicLiabCompany: string;
  commercialIns: boolean;

  taxId: string;
  wht: number | null;
  bankAcct: string;
  payPct: number | null;
  bonusPct: number | null;
  subContractorPercentage: number | null;
  subContractorFuelPercentage: number | null;
  subContractorBonusPercentage: number | null;
  paydayReg: boolean;
  contractSigned: string | null;
  securityCheck: string | null;

  deviceAdmin: boolean;
  vodafone: boolean;
  smsJob: boolean;
  smsAlert: boolean;
  webEnabled: boolean;
  autoDispatch: boolean;
  showClientPhone: boolean;
  displayWeb: boolean;
  podRequired: boolean;
  startTime: string | null;
  endTime: string | null;

  notes: string;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;

  // Whether a master-controller mobile-app login exists for this courier.
  // null = couldn't be determined (master DB unreachable) — UI treats only an
  // explicit false as "no login".
  hasMobileLogin: boolean | null;
}

// Trim ISO datetime down to YYYY-MM-DD for <input type="date"> binding;
// the rich Courier type expects flat date strings on these fields.
function dateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

function timeOnly(iso: string | null | undefined): string {
  if (!iso) return '';
  // Date+time ISO → "HH:mm"
  const t = iso.slice(11, 16);
  return t || '';
}

function genderLabel(g: boolean | null): string {
  if (g === true) return 'Male';
  if (g === false) return 'Female';
  return '';
}

// Map the rich backend shape into the React Courier type. Lookup-backed
// fields (insuranceCo, carrierLiab, publicLiab, channel, deviceType, make)
// get safe defaults until later passes add the corresponding joins.
function toCourier(dto: NpFleetCourierApi): Courier {
  // Role is driven by CourierTypeId, not the master FK — so an Independent
  // (no master, no subs) no longer renders as a Master with zero subs.
  const typeLabel: Courier['type'] = (() => {
    switch (dto.courierTypeId) {
      case 2: return 'Master';
      case 3: return 'Sub';
      case 4: return 'Gig';
      default: return 'Independent';   // 1 (or unset legacy rows)
    }
  })();
  const c: Partial<Courier> = {
    id: dto.id,
    code: dto.code,
    type: typeLabel,
    master: dto.masterCourierId,
    npAgentId: dto.npAgentId ?? null,
    npAgentName: dto.npAgentName ?? '',
    paymentMethod: dto.paymentMethod ?? 'Direct',

    firstName: dto.firstName,
    surName: dto.surName,
    email: dto.email,
    urgentMobile: dto.phone,
    phone: dto.mobile,
    homePhone: dto.homePhone,
    gender: genderLabel(dto.gender),
    dob: dateOnly(dto.dob),
    address: dto.address,
    doctor: dto.doctor,
    doctorPhone: dto.doctorPhone,
    nextOfKin: dto.nextOfKin,
    nokRelationship: dto.nokRelationship,
    nokAddress: dto.nokAddress,
    nokPhone: dto.nokPhone,
    startDate: dateOnly(dto.startDate),
    finishDate: dateOnly(dto.finishDate),
    status: dto.active ? 'active' : 'inactive',

    vehicle: dto.vehicle,
    make: dto.make,
    makeId: dto.makeId,
    model: dto.model,
    year: dto.year ?? 0,
    rego: dto.rego,
    lowEmission: dto.lowEmission,
    maxPallets: dto.maxPallets ?? 0,
    tareWeight: dto.tareWeight ?? 0,
    maxCarry: dto.maxCarry ?? 0,
    rucWeight: dto.rucWeight ?? 0,
    rucKms: dto.rucKms ?? 0,
    rucPayload: dto.rucPayload ?? 0,
    height: dto.height ?? 0,
    width: dto.width ?? 0,
    length: dto.length ?? 0,
    inspectionExpiry: dateOnly(dto.inspectionExpiry),
    regoExpiry: dateOnly(dto.regoExpiry),

    dlNo: dto.dlNo,
    dlExpiry: dateOnly(dto.dlExpiry),
    dangerousGoods: dto.dangerousGoods,
    dgExpiry: dateOnly(dto.dgExpiry),
    hte: dto.hte,
    tslNo: dto.tslNo,

    policyNo: dto.policyNo,
    insuranceCo: dto.insuranceCo,
    insuranceCoId: dto.insuranceCoId,
    carrierLiabCompany: dto.carrierLiabCompany,
    carrierLiabId: dto.carrierLiabId,
    publicLiabCompany: dto.publicLiabCompany,
    publicLiabId: dto.publicLiabId,
    commercialIns: dto.commercialIns,

    taxId: dto.taxId,
    wht: dto.wht ?? 0,
    bankAcct: dto.bankAcct,
    payPct: dto.payPct ?? 0,
    bonusPct: dto.bonusPct ?? 0,
    subContractorPercentage: dto.subContractorPercentage ?? 0,
    subContractorFuelPercentage: dto.subContractorFuelPercentage ?? 0,
    subContractorBonusPercentage: dto.subContractorBonusPercentage ?? 0,
    paydayReg: dto.paydayReg,
    contractSigned: dateOnly(dto.contractSigned),
    securityCheck: dateOnly(dto.securityCheck),

    deviceAdmin: dto.deviceAdmin,
    vodafone: dto.vodafone,
    smsJob: dto.smsJob,
    smsAlert: dto.smsAlert,
    webEnabled: dto.webEnabled,
    autoDispatch: dto.autoDispatch,
    showClientPhone: dto.showClientPhone,
    displayWeb: dto.displayWeb,
    podRequired: dto.podRequired,
    startTime: timeOnly(dto.startTime),
    endTime: timeOnly(dto.endTime),

    notes: dto.notes,
    created: dateOnly(dto.created),
    createdBy: dto.createdBy,
    modified: dateOnly(dto.modified),
    modifiedBy: dto.modifiedBy,
    hasMobileLogin: dto.hasMobileLogin,

    location: '',
    compliance: 'ok',
    documents: [],
  };
  // Cast through Partial — Courier still has lookup-backed fields
  // (insuranceCo, carrierLiab, publicLiab, channel, deviceType, make,
  // password, podReqd alt name, etc.) we haven't wired yet. Consumers reading
  // those get undefined; the pages have defensive ?? defaults for them.
  return c as Courier;
}

async function fetchAll(): Promise<Courier[]> {
  const { data } = await api.get<NpFleetCourierApi[]>('/fleet');
  return (data ?? []).map(toCourier);
}

// Convert the React Courier draft (rich, frontend-shaped) into the backend
// update payload (NpFleetCourierUpdateDto). Inverse of toCourier — strips
// derived/identity fields and converts the few mismatched representations
// (gender label → bool?, date strings → ISO).
function toUpdatePayload(c: Partial<Courier>): Record<string, unknown> {
  const genderToBool = (g: string | undefined): boolean | null => {
    if (g === 'Male') return true;
    if (g === 'Female') return false;
    return null;
  };
  const isoOrNull = (s: string | undefined | null): string | null => {
    if (!s) return null;
    return s; // backend parses YYYY-MM-DD into DateTime fine
  };
  // <input type="time"> emits "HH:mm" alone, which DateTime? can't parse.
  // Anchor it to a stable epoch date so the round-trip works.
  const timeAsIso = (t: string | undefined | null): string | null => {
    if (!t) return null;
    if (t.length === 5 && t.includes(':')) return `2000-01-01T${t}:00`;
    return t;
  };
  const numOrNull = (n: number | undefined): number | null => {
    return n == null || Number.isNaN(n) ? null : n;
  };

  // Role label → CourierTypeId. masterCourierId is sent only for Sub; the
  // backend clears it for any other role and validates integrity (§4.3).
  const typeToId: Record<string, number> = { Independent: 1, Master: 2, Sub: 3, Gig: 4 };

  return {
    courierTypeId: c.type ? (typeToId[c.type] ?? null) : null,
    masterCourierId: c.type === 'Sub' ? (c.master ?? null) : null,
    // NP assignment (null = Direct) — server write-guards to Admin/Tenant.
    npAgentId: c.npAgentId ?? null,
    // Payment channel — server enum-validates {Direct,Invoice,None}.
    paymentMethod: c.paymentMethod ?? null,
    firstName: c.firstName ?? '',
    surName: c.surName ?? '',
    email: c.email ?? '',
    phone: c.urgentMobile ?? '',
    mobile: c.phone ?? '',
    homePhone: c.homePhone ?? '',
    gender: genderToBool(c.gender),
    dob: isoOrNull(c.dob),
    address: c.address ?? '',
    doctor: c.doctor ?? '',
    doctorPhone: c.doctorPhone ?? '',
    nextOfKin: c.nextOfKin ?? '',
    nokRelationship: c.nokRelationship ?? '',
    nokAddress: c.nokAddress ?? '',
    nokPhone: c.nokPhone ?? '',
    startDate: isoOrNull(c.startDate),
    finishDate: isoOrNull(c.finishDate),
    active: c.status === 'active',

    vehicle: c.vehicle ?? '',
    makeId: c.makeId ?? null,
    model: c.model ?? '',
    year: numOrNull(c.year),
    rego: c.rego ?? '',
    lowEmission: !!c.lowEmission,
    maxPallets: numOrNull(c.maxPallets),
    tareWeight: numOrNull(c.tareWeight),
    maxCarry: numOrNull(c.maxCarry),
    rucWeight: numOrNull(c.rucWeight),
    rucKms: numOrNull(c.rucKms),
    rucPayload: numOrNull(c.rucPayload),
    height: numOrNull(c.height),
    width: numOrNull(c.width),
    length: numOrNull(c.length),
    inspectionExpiry: isoOrNull(c.inspectionExpiry),
    regoExpiry: isoOrNull(c.regoExpiry),

    dlNo: c.dlNo ?? '',
    dlExpiry: isoOrNull(c.dlExpiry),
    dangerousGoods: !!c.dangerousGoods,
    dgExpiry: isoOrNull(c.dgExpiry),
    hte: !!c.hte,
    tslNo: c.tslNo ?? '',

    policyNo: c.policyNo ?? '',
    insuranceCoId: c.insuranceCoId ?? null,
    carrierLiabId: c.carrierLiabId ?? null,
    publicLiabId: c.publicLiabId ?? null,
    commercialIns: !!c.commercialIns,

    taxId: c.taxId ?? '',
    wht: numOrNull(c.wht),
    bankAcct: c.bankAcct ?? '',
    payPct: numOrNull(c.payPct),
    bonusPct: numOrNull(c.bonusPct),
    subContractorPercentage: numOrNull(c.subContractorPercentage),
    subContractorFuelPercentage: numOrNull(c.subContractorFuelPercentage),
    subContractorBonusPercentage: numOrNull(c.subContractorBonusPercentage),
    paydayReg: !!c.paydayReg,
    contractSigned: isoOrNull(c.contractSigned),
    securityCheck: isoOrNull(c.securityCheck),

    deviceAdmin: !!c.deviceAdmin,
    vodafone: !!c.vodafone,
    smsJob: !!c.smsJob,
    smsAlert: !!c.smsAlert,
    webEnabled: !!c.webEnabled,
    autoDispatch: !!c.autoDispatch,
    showClientPhone: !!c.showClientPhone,
    displayWeb: !!c.displayWeb,
    podRequired: !!c.podRequired,
    startTime: timeAsIso(c.startTime),
    endTime: timeAsIso(c.endTime),

    notes: c.notes ?? '',
  };
}

export const courierService = {
  getAll(_status?: string): Promise<Courier[]> {
    return fetchAll();
  },

  async getById(id: number): Promise<Courier | undefined> {
    const all = await fetchAll();
    return all.find(c => c.id === id);
  },

  async getActive(): Promise<Courier[]> {
    const all = await fetchAll();
    return all.filter(c => c.status === 'active');
  },

  async getMasters(): Promise<Courier[]> {
    const all = await fetchAll();
    return all.filter(c => c.type === 'Master');
  },

  async getSubsForMaster(masterId: number): Promise<Courier[]> {
    const all = await fetchAll();
    return all.filter(c => c.master === masterId);
  },

  async search(query: string, filters?: { status?: string; location?: string; vehicle?: string }): Promise<Courier[]> {
    const all = await fetchAll();
    const q = query.trim().toLowerCase();
    return all.filter(c => {
      if (q) {
        const hay = `${c.firstName} ${c.surName} ${c.code} ${c.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters?.status && filters.status !== 'All Status' && c.status !== filters.status.toLowerCase()) return false;
      if (filters?.location && filters.location !== 'All Locations' && c.location !== filters.location) return false;
      if (filters?.vehicle && filters.vehicle !== 'All Vehicles' && c.vehicle !== filters.vehicle) return false;
      return true;
    });
  },

  // Quick-add create — POST /api/v1/np/fleet. Sends the lean field set the
  // backend NpFleetCourierCreateDto accepts; the remaining ~45 Courier fields
  // are filled afterwards via CourierSetup (Edit). Courier.phone holds the
  // personal mobile (see toCourier), so it maps to the DTO's `mobile`.
  async create(courier: Partial<Courier>): Promise<Courier> {
    const typeToId: Record<string, number> = { Independent: 1, Master: 2, Sub: 3, Gig: 4 };
    const payload = {
      code: (courier.code ?? '').trim(),
      firstName: (courier.firstName ?? '').trim(),
      surName: (courier.surName ?? '').trim(),
      email: (courier.email ?? '').trim(),
      mobile: courier.phone ?? '',
      vehicleType: courier.vehicle ?? '',
      notes: courier.notes ?? '',
      // Role / master so Quick Add can create a Sub and inherit the master's NP
      // (GARRY-NP-SUB-INHERIT-NP). null type → backend defaults to Independent.
      courierTypeId: courier.type ? (typeToId[courier.type] ?? null) : null,
      masterCourierId: courier.type === 'Sub' ? (courier.master ?? null) : null,
      npAgentId: courier.npAgentId ?? null,
      // Mobile-app login password — provisions the master-controller User row.
      password: courier.password ?? '',
    };
    const { data } = await api.post<NpFleetCourierApi>('/fleet', payload);
    if (!data) throw new Error('Server returned no courier');
    return toCourier(data);
  },

  async update(id: number, courier: Partial<Courier>): Promise<Courier> {
    const payload = toUpdatePayload(courier);
    const { data } = await api.put<NpFleetCourierApi>(`/fleet/${id}`, payload);
    if (!data) throw new Error('Server returned no courier');
    return toCourier(data);
  },

  // Set / reset the courier's mobile-app login password. Also provisions the
  // master-controller login if the courier never had one (heal path).
  async resetLogin(id: number, password: string): Promise<Courier> {
    const { data } = await api.post<NpFleetCourierApi>(`/fleet/${id}/reset-login`, { password });
    if (!data) throw new Error('Server returned no courier');
    return toCourier(data);
  },

  async remove(_id: number): Promise<void> {
    /* no-op stub */
  },

  async getPortalLinks(): Promise<{ courierId: number; code: string; name: string; url: string }[]> {
    const all = await fetchAll();
    return all
      .filter(c => c.status === 'active')
      .map(c => ({
        courierId: c.id,
        code: c.code,
        name: `${c.firstName} ${c.surName}`,
        url: `https://portal.dfrnt.com/courier/${c.code.toLowerCase()}`,
      }));
  },

  async getComplianceSummary(): Promise<Courier[]> {
    return fetchAll();
  },
};
