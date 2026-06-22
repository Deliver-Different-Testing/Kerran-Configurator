import courierApi from './courier_api';

// Courier Portal (finish-line P0) — at-a-glance dashboard stats. Small,
// high-confidence numbers derived server-side from the courier's own runs,
// schedule and documents.

export interface CourierDashboard {
  todaysRuns: number;
  weekCompletedRuns: number;
  nextShift: string | null;
  documentsPending: number;
  documentsRejected: number;
  documentsExpiringSoon: number;
  documentsMissingRequired: number;
}

export const courierDashboardService = {
  get: () => courierApi.get<CourierDashboard>('/dashboard').then(r => r.data),
};
