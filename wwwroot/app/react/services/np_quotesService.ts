import api from './np_api';

// Carrier-side inbox: pending Requested invitations attributed to my NP agent.
// Shape matches NpPendingInviteDto on the backend.
export interface PendingInvite {
  quoteId: number;
  postingId: number;
  postingTitle: string;
  region: string;
  serviceType: string;
  volumePerWeek: number;
  startDate: string;
  endDate: string;
  isOngoing: boolean;
  description: string;
  tenantMessage: string;
  requestedDate: string;   // ISO 8601 UTC
}

// Carrier response payload — mirrors NpQuoteSubmitDto.
export interface SubmitInvitePayload {
  proposedRate: number;
  rateType?: string | null;
  message?: string | null;
  availableFleetSize?: number | null;
  availableStartDate?: string | null;   // YYYY-MM-DD
}

export const npQuotesService = {
  listPending: () => api.get<PendingInvite[]>('/quotes/pending'),

  submit: (quoteId: number, data: SubmitInvitePayload) =>
    api.put(`/quotes/${quoteId}/submit`, data),
};
