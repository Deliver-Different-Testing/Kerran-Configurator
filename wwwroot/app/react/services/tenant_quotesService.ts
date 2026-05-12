import api from './tenant_api';
import type { QuotesPosting, Quote, CarrierSearchResult } from '@/types';

// Backend POST /quotes/postings shape — matches TenantQuotePostingCreateDto.
export interface CreatePostingPayload {
  title: string;
  region: string;
  serviceType: string;
  volumePerWeek: number;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

export interface CreateQuoteRequestPayload {
  postingId: number;
  agentId?: number | null;
  prospectAgentId?: number | null;
  message?: string | null;
}

// Carrier-side payload — Requested → Submitted transition.
export interface SubmitQuotePayload {
  proposedRate: number;
  rateType?: string | null;
  message?: string | null;
  availableFleetSize?: number | null;
  availableStartDate?: string | null;
}

export const quotesService = {
  // Postings
  listPostings: () => api.get<QuotesPosting[]>('/quotes/postings'),

  getPosting: (id: number) => api.get<QuotesPosting>(`/quotes/postings/${id}`),

  createPosting: (data: CreatePostingPayload) =>
    api.post<QuotesPosting>('/quotes/postings', data),

  // Quotes
  listQuotes: (postingId: number) => api.get<Quote[]>(`/quotes/postings/${postingId}/quotes`),

  // Discovery — placeholder; the backend /quotes/discover endpoint hasn't been
  // implemented yet (would do AI/directory search).
  searchCarriers: (query: string) =>
    api.post<{ results: CarrierSearchResult[]; message: string }>('/quotes/discover', { query }),

  // Invite a known carrier (TucAgent or ProspectAgent) to quote a posting.
  // Returns the refreshed list of quotes for that posting.
  sendQuoteRequest: (data: CreateQuoteRequestPayload) =>
    api.post<Quote[]>('/quotes/quote-request', data),

  // Award a quote — winning quote → Accepted, siblings → Declined,
  // posting → Awarded + ClosedDate. Returns the refreshed quote list.
  award: (quoteId: number) =>
    api.post<Quote[]>(`/quotes/${quoteId}/award`),

  // Carrier responds with their quote (rate, lead-time, fleet-size).
  // Transitions the quote Requested → Submitted. Returns refreshed quote list.
  submit: (quoteId: number, data: SubmitQuotePayload) =>
    api.put<Quote[]>(`/quotes/${quoteId}/submit`, data),

  // Manual sweep — marks Requested/Submitted quotes Expired when the parent
  // posting is Awarded/Closed or its EndDate has passed. Pass postingId to
  // target one posting; omit to sweep all of this tenant's quotes.
  expireSweep: (postingId?: number) =>
    api.post<{ expiredCount: number; success: boolean }>(
      `/quotes/expire-sweep${postingId ? `?postingId=${postingId}` : ''}`,
    ),
};
