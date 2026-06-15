import courierApi from './courier_api';

// Phase 2 — courier profile client (mirrors Core/Application/Dtos/Courier).

export interface CourierProfile {
  id: number;
  code: string;
  firstName: string;
  surname: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  addressLine5: string | null;
  addressLine6: string | null;
  addressLine7: string | null;
  addressLine8: string | null;
  driversLicenceNo: string | null;
  vehicleRegistrationNo: string | null;
  bankRoutingNumber: string | null;
  bankAccountNo: string | null;
  taxNo: string | null;
  courierTypeId: number;
  isMaster: boolean;
}

export type CourierProfileUpdate = Omit<CourierProfile, 'id' | 'code' | 'courierTypeId' | 'isMaster'>;

export const courierProfileService = {
  get: () => courierApi.get<CourierProfile>('/profile').then(r => r.data),
  update: (p: CourierProfileUpdate) => courierApi.put<CourierProfile>('/profile', p).then(r => r.data),
};
