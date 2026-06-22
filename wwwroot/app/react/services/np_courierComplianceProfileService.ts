import api from './np_api';

// Courier modal §11 — assign ComplianceProfiles ("roles") to a courier. The
// assigned profiles' required documents drive the courier's required-document
// list on the Compliance & Licensing tab. Backed by
// GET/PUT /api/v1/np/couriers/{id}/compliance-profiles (TenantStaffOrAdmin).

export interface ComplianceProfileOption {
  id: number;
  name: string;
  description: string;
}

export interface CourierComplianceProfiles {
  available: ComplianceProfileOption[];
  assignedProfileIds: number[];
  requiredDocumentTypeIds: number[];
}

export const courierComplianceProfileService = {
  get: (courierId: number) =>
    api.get<CourierComplianceProfiles>(`/couriers/${courierId}/compliance-profiles`).then(r => r.data),

  set: (courierId: number, profileIds: number[]) =>
    api.put<CourierComplianceProfiles>(`/couriers/${courierId}/compliance-profiles`, { profileIds }).then(r => r.data),
};
