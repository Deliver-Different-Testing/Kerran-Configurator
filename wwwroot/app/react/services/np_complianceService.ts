// Live — backed by /api/v1/np/compliance/* (Phase 5+25). Paths are relative
// to the np_api axios baseURL (/api/v1/np), so they start with /compliance/...
// (not /v1/np/compliance/... — that was a pre-existing path bug in the stub).
import api from './np_api';
import type {
  ComplianceDashboard,
  ComplianceAlert,
  CourierComplianceScore,
  ComplianceAlertFilter,
} from '@/types';

export const complianceService = {
  async getDashboard(): Promise<ComplianceDashboard> {
    const { data } = await api.get<ComplianceDashboard>('/compliance/dashboard');
    return data;
  },

  async getAlerts(filters?: ComplianceAlertFilter): Promise<ComplianceAlert[]> {
    const params: Record<string, string | number> = {};
    if (filters?.docType) params.docType = filters.docType;
    if (filters?.status) params.status = filters.status;
    if (filters?.courierName) params.courierName = filters.courierName;
    if (filters?.daysAhead) params.daysAhead = filters.daysAhead;
    const { data } = await api.get<ComplianceAlert[]>('/compliance/alerts', { params });
    return data;
  },

  async getCourierScore(courierId: number): Promise<CourierComplianceScore> {
    const { data } = await api.get<CourierComplianceScore>(`/compliance/score/${courierId}`);
    return data;
  },

  // Bulk reminder dispatch — backend deferred (the React handler is a placeholder
  // 800ms delay). Wiring this would route through the tucManualMessage outbox
  // pattern used by QuoteNotificationService; track as separate slice if needed.
  async bulkNotify(_courierIds: number[]): Promise<{ notified: number }> {
    throw new Error('bulkNotify() not yet wired to backend');
  },
};
