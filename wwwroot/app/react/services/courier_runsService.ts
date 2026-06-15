import courierApi from './courier_api';

// Phase 2 — My Runs client (mirrors Core/Application/Dtos/Courier run DTOs).

export interface CourierJob {
  jobId: number;
  jobNumber: string;
  clientCode: string;
  courierPayment: number;
  courierFuel: number;
  courierBonus: number;
  deliveryAddressLine1: string | null;
  deliveryAddressLine2: string | null;
  deliveryAddressLine3: string | null;
  deliveryAddressLine4: string | null;
  deliveryAddressLine5: string | null;
  deliveryAddressLine6: string | null;
  deliveryAddressLine7: string | null;
  deliveryAddressLine8: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  void: boolean;
  status: string;
}

export interface CourierRun {
  id: number;
  bookDate: string;
  dateDisplay: string;
  runName: string;
  kms: number;
  time: number;
  amount: number;
  cities: string;
  states: string;
  jobs: CourierJob[];
}

export interface CourierRunsResult {
  current: CourierRun[];
  past: CourierRun[];
}

export const courierRunsService = {
  list: () => courierApi.get<CourierRunsResult>('/runs').then(r => r.data),
  detail: (bookDate: string, runName: string) =>
    courierApi
      .get<CourierRun>('/runs/detail', { params: { bookDate, runName } })
      .then(r => r.data),
  enquiry: (jobNumber: string, message: string) =>
    courierApi.post('/runs/enquiry', { jobNumber, message }).then(r => r.data),
};
