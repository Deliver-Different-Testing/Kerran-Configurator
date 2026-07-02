import api from './np_api';

// Courier modal §17b — operator-facing 2FA (SMS) enrolment. Read status + send a
// fresh enrolment code to the courier's mobile. Backed by
// GET  /api/v1/np/couriers/{id}/2fa/status
// POST /api/v1/np/couriers/{id}/2fa/send-code   (TenantStaffOrAdmin)

export interface CourierTwoFactorStatus {
  mobileVerified: boolean;
  mobileVerifiedDate: string | null;
  mobileNeedsReview: boolean;
  hasMobile: boolean;
  smsConfigured: boolean;
}

export const courier2faService = {
  status: (courierId: number) =>
    api.get<CourierTwoFactorStatus>(`/couriers/${courierId}/2fa/status`).then(r => r.data),

  sendCode: (courierId: number) =>
    api.post<{ accepted: boolean; message: string }>(`/couriers/${courierId}/2fa/send-code`, {}).then(r => r.data),
};
