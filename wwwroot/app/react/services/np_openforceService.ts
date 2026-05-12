// TODO: Openforce is handled by Accounts app. This service should call Accounts API endpoints.
// When Accounts API is available, replace localStorage calls with real API calls to:
//   GET  /api/v1/accounts/openforce/settings
//   PUT  /api/v1/accounts/openforce/settings
//   POST /api/v1/accounts/openforce/test-connection
//   GET  /api/v1/accounts/openforce/api-log
//
// Openforce Integration Service — localStorage-backed prototype (dev fallback)

export interface OfSettings {
  clientId: string;
  clientGuid: string;
  accessKey: string;
  apiKey: string;
  activationCodeIC: string;
  activationCodeMaster: string;
  activationCodeSub: string;
  connected: boolean;
  lastSync: string | null;
}

export interface OfApiLogEntry {
  id: string;
  timestamp: string;
  direction: 'Outbound' | 'Inbound';
  endpoint: string;
  status: number;
  success: boolean;
  durationMs: number;
  responseSummary: string;
  category: 'invitation' | 'settlement' | 'webhook' | 'contractor' | 'auth' | 'other';
}

const SETTINGS_KEY = 'np_openforce_settings';
const LOG_KEY = 'np_openforce_api_log';

const defaultSettings: OfSettings = {
  clientId: '',
  clientGuid: '',
  accessKey: '',
  apiKey: '',
  activationCodeIC: '',
  activationCodeMaster: '',
  activationCodeSub: '',
  connected: false,
  lastSync: null,
};

function generateMockLog(): OfApiLogEntry[] {
  const now = Date.now();
  const h = 3600000;
  const entries: OfApiLogEntry[] = [
    { id: 'log-01', timestamp: new Date(now - 0.5 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/invitations', status: 201, success: true, durationMs: 342, responseSummary: 'Invitation created — ID 8847', category: 'invitation' },
    { id: 'log-02', timestamp: new Date(now - 1.2 * h).toISOString(), direction: 'Outbound', endpoint: 'GET /api/v1/contractors?search=Smith', status: 200, success: true, durationMs: 189, responseSummary: '3 contractors returned', category: 'contractor' },
    { id: 'log-03', timestamp: new Date(now - 2.1 * h).toISOString(), direction: 'Inbound', endpoint: 'POST /webhooks/openforce/contract_activated', status: 200, success: true, durationMs: 45, responseSummary: 'Webhook processed — contractor 4421 activated', category: 'webhook' },
    { id: 'log-04', timestamp: new Date(now - 3.5 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/settlements', status: 200, success: true, durationMs: 567, responseSummary: 'Settlement batch #112 submitted — 14 items', category: 'settlement' },
    { id: 'log-05', timestamp: new Date(now - 5 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/invitations', status: 400, success: false, durationMs: 210, responseSummary: 'Bad Request: email already registered', category: 'invitation' },
    { id: 'log-06', timestamp: new Date(now - 6 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/invitations', status: 201, success: true, durationMs: 298, responseSummary: 'Invitation created — ID 8846', category: 'invitation' },
    { id: 'log-07', timestamp: new Date(now - 8 * h).toISOString(), direction: 'Outbound', endpoint: 'GET /api/v1/contractors/4421', status: 200, success: true, durationMs: 145, responseSummary: 'Contractor details returned', category: 'contractor' },
    { id: 'log-08', timestamp: new Date(now - 10 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/settlements', status: 500, success: false, durationMs: 12300, responseSummary: 'Internal Server Error — timeout after 12s', category: 'settlement' },
    { id: 'log-09', timestamp: new Date(now - 12 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/auth/token', status: 200, success: true, durationMs: 410, responseSummary: 'Access token refreshed', category: 'auth' },
    { id: 'log-10', timestamp: new Date(now - 14 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/invitations', status: 201, success: true, durationMs: 315, responseSummary: 'Invitation created — ID 8845', category: 'invitation' },
    { id: 'log-11', timestamp: new Date(now - 16 * h).toISOString(), direction: 'Inbound', endpoint: 'POST /webhooks/openforce/settlement_complete', status: 200, success: true, durationMs: 38, responseSummary: 'Settlement #111 confirmed', category: 'webhook' },
    { id: 'log-12', timestamp: new Date(now - 20 * h).toISOString(), direction: 'Outbound', endpoint: 'GET /api/v1/contractors?search=Johnson', status: 200, success: true, durationMs: 176, responseSummary: '1 contractor returned', category: 'contractor' },
    { id: 'log-13', timestamp: new Date(now - 24 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/settlements', status: 200, success: true, durationMs: 489, responseSummary: 'Settlement batch #111 submitted — 8 items', category: 'settlement' },
    { id: 'log-14', timestamp: new Date(now - 28 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/invitations', status: 201, success: true, durationMs: 267, responseSummary: 'Invitation created — ID 8844', category: 'invitation' },
    { id: 'log-15', timestamp: new Date(now - 30 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/invitations', status: 500, success: false, durationMs: 15000, responseSummary: 'Server Error — connection timeout', category: 'invitation' },
    { id: 'log-16', timestamp: new Date(now - 34 * h).toISOString(), direction: 'Outbound', endpoint: 'GET /api/v1/contractors?search=Williams', status: 200, success: true, durationMs: 201, responseSummary: '2 contractors returned', category: 'contractor' },
    { id: 'log-17', timestamp: new Date(now - 38 * h).toISOString(), direction: 'Inbound', endpoint: 'POST /webhooks/openforce/contract_activated', status: 200, success: true, durationMs: 52, responseSummary: 'Webhook processed — contractor 4419 activated', category: 'webhook' },
    { id: 'log-18', timestamp: new Date(now - 42 * h).toISOString(), direction: 'Outbound', endpoint: 'POST /api/v1/settlements', status: 200, success: true, durationMs: 534, responseSummary: 'Settlement batch #110 submitted — 11 items', category: 'settlement' },
  ];
  return entries;
}

export const openforceService = {
  getSettings(): OfSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
    return { ...defaultSettings };
  },

  saveSettings(settings: OfSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  async testConnection(settings: OfSettings): Promise<boolean> {
    // Simulate API test — connected if clientId + apiKey provided
    await new Promise(r => setTimeout(r, 1200));
    return !!(settings.clientId && settings.apiKey && settings.accessKey);
  },

  getApiLog(): OfApiLogEntry[] {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw);
    // Seed with mock data on first load
    const mock = generateMockLog();
    localStorage.setItem(LOG_KEY, JSON.stringify(mock));
    return mock;
  },

  clearApiLog(): void {
    localStorage.removeItem(LOG_KEY);
  },
};
