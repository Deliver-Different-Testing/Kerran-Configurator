import axios from 'axios';

// Anonymous public-link axios instance for the slice-2b external-carrier
// flow. No cookie credentials (anonymous), no 401-redirect interceptor
// (there's no Hub session to re-auth into). X-Requested-With is still sent
// to satisfy the configurator's CSRF middleware which checks the header
// on all state-changing requests.
const api = axios.create({
  baseURL: '/api/public/quotes',
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export interface PublicInvite {
  quoteId: number;
  status: 'Requested' | 'Submitted';
  postingTitle: string;
  region: string;
  serviceType: string;
  volumePerWeek: number;
  startDate: string;
  endDate: string;
  isOngoing: boolean;
  description: string;
  tenantMessage: string;
  prospectName: string;
  // Echoed previous response (populated when status === 'Submitted')
  proposedRate: number | null;
  rateType: string | null;
  availableFleetSize: number | null;
  availableStartDate: string;
  responseMessage: string;
}

export interface SubmitPublicQuotePayload {
  proposedRate: number;
  rateType?: string | null;
  message?: string | null;
  availableFleetSize?: number | null;
  availableStartDate?: string | null;
}

export const publicQuotesService = {
  getInvite: (token: string) => api.get<PublicInvite>(`/${encodeURIComponent(token)}`),

  submit: (token: string, data: SubmitPublicQuotePayload) =>
    api.put(`/${encodeURIComponent(token)}/submit`, data),
};
