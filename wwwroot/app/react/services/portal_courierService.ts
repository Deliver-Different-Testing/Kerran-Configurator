import portalApi from './portal_api';
import type {
  CourierProfile,
  Schedule,
  Run,
  UninvoicedData,
  Invoice,
  Subcontractor,
  ReportSummary,
} from './portal_mockData';

// PortalController route: api/v1/portal
// Courier-portal authenticated endpoints (served by courier-portal backend)

export const portalService = {
  // ── Dashboard ──
  async getDashboard(): Promise<{
    profile: CourierProfile;
    upcomingRuns: Run[];
    recentInvoices: Invoice[];
    reportSummary: ReportSummary;
  }> {
    try {
      const { data } = await portalApi.get('/dashboard');
      return data;
    } catch {
      return {
        profile: {} as CourierProfile,
        upcomingRuns: [],
        recentInvoices: [],
        reportSummary: {} as ReportSummary,
      };
    }
  },

  // ── Profile ──
  async getProfile(): Promise<CourierProfile | null> {
    try {
      const { data } = await portalApi.get('/profile');
      return data;
    } catch {
      return null;
    }
  },

  async updateProfile(updates: Partial<CourierProfile>): Promise<CourierProfile> {
    const { data } = await portalApi.put('/profile', updates);
    return data;
  },

  // ── Runs ──
  async getRuns(status?: string): Promise<Run[]> {
    try {
      const params = status ? { status } : {};
      const { data } = await portalApi.get('/runs', { params });
      return data;
    } catch {
      return [];
    }
  },

  async getRunById(id: number): Promise<Run | null> {
    try {
      const { data } = await portalApi.get(`/runs/${id}`);
      return data;
    } catch {
      return null;
    }
  },

  // ── Schedules / Availability ──
  async getSchedules(): Promise<Schedule[]> {
    try {
      const { data } = await portalApi.get('/schedules');
      return data;
    } catch {
      return [];
    }
  },

  async respondToSchedule(
    scheduleId: number,
    response: { statusId: 1 | 2 | 3; timeSlotId?: number }
  ): Promise<void> {
    await portalApi.post(`/schedules/${scheduleId}/respond`, response);
  },

  // ── Invoicing ──
  async getUninvoiced(): Promise<UninvoicedData | null> {
    try {
      const { data } = await portalApi.get('/invoicing/uninvoiced');
      return data;
    } catch {
      return null;
    }
  },

  async submitInvoice(): Promise<{ invoiceNo: string }> {
    const { data } = await portalApi.post('/invoicing/submit');
    return data;
  },

  async getRecentInvoices(): Promise<Invoice[]> {
    try {
      const { data } = await portalApi.get('/invoicing/recent');
      return data;
    } catch {
      return [];
    }
  },

  async getPastInvoices(page?: number, pageSize?: number): Promise<Invoice[]> {
    try {
      const params: Record<string, number> = {};
      if (page) params.page = page;
      if (pageSize) params.pageSize = pageSize;
      const { data } = await portalApi.get('/invoicing/history', { params });
      return data;
    } catch {
      return [];
    }
  },

  async downloadInvoice(invoiceNo: string): Promise<Blob> {
    const { data } = await portalApi.get(`/invoicing/${invoiceNo}/download`, {
      responseType: 'blob',
    });
    return data;
  },

  // ── Subcontractors (master courier view) ──
  async getSubcontractors(): Promise<Subcontractor[]> {
    try {
      const { data } = await portalApi.get('/subcontractors');
      return data;
    } catch {
      return [];
    }
  },

  // ── Reports ──
  async getReportSummary(): Promise<ReportSummary | null> {
    try {
      const { data } = await portalApi.get('/reports/summary');
      return data;
    } catch {
      return null;
    }
  },

  // ── Documents (courier-portal manages doc uploads for portal users) ──
  async getDocuments(): Promise<unknown[]> {
    try {
      const { data } = await portalApi.get('/documents');
      return data;
    } catch {
      return [];
    }
  },

  async uploadDocument(documentTypeId: number, file: File): Promise<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentTypeId', String(documentTypeId));
    const { data } = await portalApi.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // ── Application (public, no auth) ──
  async submitApplication(application: Record<string, unknown>): Promise<{ id: number }> {
    const { data } = await portalApi.post('/apply', application);
    return data;
  },

  async getTenantBranding(slug: string): Promise<Record<string, unknown>> {
    try {
      const { data } = await portalApi.get(`/tenant/${slug}`);
      return data;
    } catch {
      return {};
    }
  },

  async getTenantRequirements(slug: string): Promise<unknown[]> {
    try {
      const { data } = await portalApi.get(`/tenant/${slug}/requirements`);
      return data;
    } catch {
      return [];
    }
  },
};
