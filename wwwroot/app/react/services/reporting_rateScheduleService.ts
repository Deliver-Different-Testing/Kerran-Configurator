import api from './reporting_api';

// Typed client for the Client Reporting / Rate Schedule backend. Shapes mirror
// the Reporting DTOs (Core/Application/Dtos/Reporting/*). Replaces the raw
// fetch() calls the standalone app used so CSRF + cookie auth are handled.

export interface ReportingClient {
  id: number;
  code: string;
  name: string;
  siteId: number;
  homeSuburbId: number | null;
  homeSuburbName: string | null;
  economyActive: boolean;
  economyRuns: boolean;
  ppdRate: number | null;
}

export interface ReportingSite {
  siteId: number;
  name: string;
}

export interface ReportingSpeed {
  id: number;
  name: string;
  shortName: string;
  systemName: string;
  minutes: number | null;
  groupingId: number;
  groupingName: string | null;
}

export interface ReportingSuburb {
  id: number;
  name: string;
  siteId: number;
  zone: number;
}

export interface RateScheduleItem {
  toSuburbId: number;
  toSuburbName: string;
  jobTypeId: number;
  speedName: string;
  minutes: number | null;
  rate: number;
  availability: string;
  areaOneCarJob: boolean;
  pedal: boolean;
  groupingId: number;
}

export interface RegionalRateItem {
  fromCityCode: string;
  fromCityName: string;
  toCityCode: string;
  toCityName: string;
  speedName: string;
  weightTier: string;
  weightMinKg: number;
  weightMaxKg: number;
  rate: number;
  availability: string;
}

export interface InternationalRateItem {
  destinationCode: string;
  city: string;
  country: string;
  region: string;
  speedName: string;
  weightTier: string;
  weightMinKg: number;
  weightMaxKg: number;
  rate: number;
  availability: string;
  requiresQuote: boolean;
}

export interface RateScheduleResponse {
  clientName: string;
  fromSuburbName: string;
  preparedFor: string;
  standardRate: number;
  vanRate: number;
  startingExcessWeight: number;
  items: RateScheduleItem[];
  regionalItems: RegionalRateItem[];
  internationalItems: InternationalRateItem[];
  isProspect: boolean;
  prospectCompanyName: string | null;
}

export interface GenerateRatePayload {
  clientId: number;
  fromSuburbId?: number | null;
  preparedFor?: string | null;
  includeGst: boolean;
  includeFuelSurcharge: boolean;
  markup: number;
  includePpd: boolean;
  suburbIds: number[];
  jobTypeIds: number[];
}

export interface ProspectLocationPayload {
  name: string;
  code?: string | null;
  zone?: string | null;
  region?: string | null;
}

export interface ProspectRatePayload {
  companyName: string;
  contactName?: string | null;
  locationMode?: string;
  locations: ProspectLocationPayload[];
  baseRateCodeId?: number | null;
  includeGst: boolean;
  includeFuelSurcharge: boolean;
  markup: number;
}

export const rateScheduleService = {
  // Lookups for the picker UI. Client search is NP-scoped server-side.
  searchClients: (q: string, limit = 20) =>
    api.get<ReportingClient[]>(`/clients?q=${encodeURIComponent(q)}&limit=${limit}`),

  getSites: () => api.get<ReportingSite[]>('/sites'),

  getSpeeds: () => api.get<ReportingSpeed[]>('/speeds'),

  getSuburbs: (siteId: number) => api.get<ReportingSuburb[]>(`/suburbs?siteId=${siteId}`),

  // Generate a rate schedule for an existing client.
  generate: (payload: GenerateRatePayload) =>
    api.post<RateScheduleResponse>('/rate-schedule/generate', payload),

  // Generate an ad-hoc multi-location prospect quote (no client record).
  prospect: (payload: ProspectRatePayload) =>
    api.post<RateScheduleResponse>('/rate-schedule/prospect', payload),
};
