// Recruitment pipeline — read side wired to /api/v1/np/recruitment
// (legacy CourierApplicant, migration 031). Mutating actions (advance /
// approve / reject / resubmit) are a later slice and stay stubbed.
import api from './np_api';
import type {
  CourierApplicant,
  ApplicantFilter,
  PipelineSummary,
  ApplicantPipelineStage,
  ApplicantDocumentSummary,
} from '@/types';

export interface PortalConfig {
  slug: string;
  portalEnabled: boolean;
  applyPath: string;
  displayName: string;
}

interface ApplicantDocApi {
  documentTypeName: string;
  category: string;
  mandatory: boolean;
  status: string;
  fileName: string;
  uploadedDate: string | null;
}

interface ApplicantApi {
  id: number;
  regionId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehiclePlate: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBsb: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelationship: string;
  pipelineStage: string;
  declarationSigned: boolean;
  declarationSignedDate: string | null;
  rejectedDate: string | null;
  rejectedReason: string;
  approvedAsCourierId: number | null;
  createdDate: string;
  modifiedDate: string | null;
  notes: string;
  documents: ApplicantDocApi[];
}

function toDocument(d: ApplicantDocApi): ApplicantDocumentSummary {
  return {
    documentTypeName: d.documentTypeName,
    category: d.category,
    mandatory: d.mandatory,
    status: d.status as ApplicantDocumentSummary['status'],
    fileName: d.fileName || undefined,
    uploadedDate: d.uploadedDate ?? undefined,
    expiryDate: null,
    aiConfidence: null,
  };
}

function toApplicant(a: ApplicantApi): CourierApplicant {
  return {
    id: a.id,
    tenantId: 1,                          // per-tenant DB — no real tenant id
    regionId: a.regionId ?? null,
    email: a.email,
    firstName: a.firstName,
    lastName: a.lastName,
    phone: a.phone || null,
    address: a.address || null,
    city: a.city || null,
    state: a.state || null,
    postcode: a.postcode || null,
    vehicleType: a.vehicleType || null,
    vehicleMake: a.vehicleMake || null,
    vehicleModel: a.vehicleModel || null,
    vehicleYear: a.vehicleYear ?? null,
    vehiclePlate: a.vehiclePlate || null,
    bankAccountName: a.bankAccountName || null,
    bankAccountNumber: a.bankAccountNumber || null,
    bankBSB: a.bankBsb || null,
    nextOfKinName: a.nextOfKinName || null,
    nextOfKinPhone: a.nextOfKinPhone || null,
    nextOfKinRelationship: a.nextOfKinRelationship || null,
    pipelineStage: a.pipelineStage as ApplicantPipelineStage,
    declarationSigned: a.declarationSigned,
    declarationSignedDate: a.declarationSignedDate ?? null,
    declarationSignatureS3Key: null,      // legacy stores the signature as a blob
    rejectedDate: a.rejectedDate ?? null,
    rejectedReason: a.rejectedReason || null,
    approvedAsCourierId: a.approvedAsCourierId ?? null,
    createdDate: a.createdDate,
    modifiedDate: a.modifiedDate ?? null,
    notes: a.notes || null,
    documents: (a.documents ?? []).map(toDocument),
  };
}

export const recruitmentService = {
  async getApplicants(filters?: ApplicantFilter): Promise<CourierApplicant[]> {
    const { data } = await api.get<ApplicantApi[]>('/recruitment/applicants');
    let list = (data ?? []).map(toApplicant);
    if (filters?.stage) list = list.filter(a => a.pipelineStage === filters.stage);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a => `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q));
    }
    return list;
  },

  async getApplicantById(id: number): Promise<CourierApplicant | undefined> {
    const { data } = await api.get<ApplicantApi>(`/recruitment/applicants/${id}`);
    return data ? toApplicant(data) : undefined;
  },

  async getPipelineSummary(): Promise<PipelineSummary[]> {
    const { data } = await api.get<PipelineSummary[]>('/recruitment/pipeline-summary');
    return data ?? [];
  },

  // Item 2 — the deployment's real applicant-portal config (slug + enabled state)
  // so Recruitment Advertising builds the actual /apply/{slug} URL.
  async getPortalConfig(): Promise<PortalConfig> {
    const { data } = await api.get<PortalConfig>('/recruitment/portal-config');
    return data;
  },

  // ── Stage actions (Slice B) — flag transitions on CourierApplicant. ──
  async advanceStage(id: number): Promise<CourierApplicant> {
    const { data } = await api.put<ApplicantApi>(`/recruitment/applicants/${id}/advance`);
    return toApplicant(data);
  },

  async rejectApplicant(id: number, reason: string): Promise<CourierApplicant> {
    const { data } = await api.put<ApplicantApi>(`/recruitment/applicants/${id}/reject`, { reason });
    return toApplicant(data);
  },

  async resubmitApplicant(id: number): Promise<CourierApplicant> {
    const { data } = await api.put<ApplicantApi>(`/recruitment/applicants/${id}/resubmit`);
    return toApplicant(data);
  },

  // Approve → courier promotion. courierCode blank = backend auto-assigns.
  async approveApplicant(
    id: number,
    payload: { courierCode?: string; courierFleetId: number },
  ): Promise<CourierApplicant> {
    const { data } = await api.post<ApplicantApi>(`/recruitment/applicants/${id}/approve`, {
      courierCode: payload.courierCode ?? '',
      courierFleetId: payload.courierFleetId,
    });
    return toApplicant(data);
  },

  // Courier fleets for the activate dropdown.
  async getCourierFleets(): Promise<{ id: number; name: string }[]> {
    const { data } = await api.get<{ id: number; name: string }[]>('/lookups/courier-fleets');
    return data ?? [];
  },

  // ── Applicant create/edit — not yet wired. ──
  createApplicant(_data: Partial<CourierApplicant>): CourierApplicant {
    throw new Error('createApplicant() not yet wired to backend');
  },
  updateApplicant(_id: number, _updates: Partial<CourierApplicant>): CourierApplicant | undefined {
    return undefined;
  },
  deleteApplicant(_id: number): boolean {
    return false;
  },
};
