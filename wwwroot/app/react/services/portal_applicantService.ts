import applicantApi from './applicant_api';

// Courier Portal (Phase 1) — typed client for the applicant lightweight-auth
// backend (/api/portal). Mirrors the C# DTOs in Core/Application/Dtos/Portal.

export interface PortalApplicant {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  phone: string | null;
  emailVerified: boolean;
  pipelineStage: string;
  // progress (editable)
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postCode: string | null;
  driversLicenceNo: string | null;
  vehicleType: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleRegistrationNo: string | null;
  bankAccountName: string | null;
  bankAccountNo: string | null;
  bankBsb: string | null;
  nextOfKin: string | null;
  nextOfKinRelationship: string | null;
  nextOfKinPhone: string | null;
  notes: string | null;
}

export interface PortalSession {
  token: string;
  expires: string;
  applicant: PortalApplicant;
}

export interface PortalRegisterResult {
  email: string;
  emailVerified: boolean;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
  vehicleType?: string;
}

export type ProgressPayload = Partial<
  Pick<
    PortalApplicant,
    | 'addressLine1' | 'city' | 'state' | 'postCode'
    | 'driversLicenceNo' | 'vehicleType' | 'vehicleMake' | 'vehicleModel'
    | 'vehicleYear' | 'vehicleRegistrationNo'
    | 'bankAccountName' | 'bankAccountNo' | 'bankBsb'
    | 'nextOfKin' | 'nextOfKinRelationship' | 'nextOfKinPhone' | 'notes'
  >
>;

export const portalApplicantService = {
  register: (p: RegisterPayload) =>
    applicantApi.post<PortalRegisterResult>('/applicants/register', p).then(r => r.data),

  verify: (email: string, code: string) =>
    applicantApi.post<PortalSession>('/applicants/emailverification', { email, code }).then(r => r.data),

  login: (email: string, password: string) =>
    applicantApi.post<PortalSession>('/auth/token', { email, password }).then(r => r.data),

  refresh: (token: string) =>
    applicantApi.post<PortalSession>('/auth/refresh', { token }).then(r => r.data),

  me: () => applicantApi.get<PortalApplicant>('/applicants').then(r => r.data),

  saveProgress: (p: ProgressPayload) =>
    applicantApi.put<PortalApplicant>('/applicants', p).then(r => r.data),
};
