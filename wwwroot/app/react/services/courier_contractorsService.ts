import courierApi from './courier_api';

// Phase 2 — master courier's subcontractors. Percentages are fractions (0–1)
// over the wire; the UI presents/edits them as whole-number percentages.

export interface CourierContractor {
  id: number;
  code: string;
  firstName: string;
  surname: string;
  percentage: number;
  fuelPercentage: number;
  bonusPercentage: number;
  active: boolean;
}

export interface ContractorUpdate {
  percentage: number;       // 0–1
  fuelPercentage: number;   // 0–1
  bonusPercentage: number;  // 0–1
}

export const courierContractorsService = {
  list: () => courierApi.get<CourierContractor[]>('/contractors').then(r => r.data),
  update: (id: number, payload: ContractorUpdate) =>
    courierApi.put<CourierContractor>(`/contractors/${id}`, payload).then(r => r.data),
};
