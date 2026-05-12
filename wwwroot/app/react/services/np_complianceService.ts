import api from './np_api';
import type {
  ComplianceDashboard,
  ComplianceAlert,
  CourierComplianceScore,
  ComplianceAlertFilter,
} from '@/types';

export const complianceService = {
  async getDashboard(): Promise<ComplianceDashboard> {
    const { data } = await api.get('/v1/np/compliance/dashboard');
    return data;
  },

  async getAlerts(filters?: ComplianceAlertFilter): Promise<ComplianceAlert[]> {
    const params: Record<string, string | number> = {};
    if (filters?.docType) params.docType = filters.docType;
    if (filters?.status) params.status = filters.status;
    if (filters?.courierName) params.courierName = filters.courierName;
    if (filters?.daysAhead) params.daysAhead = filters.daysAhead;
    const { data } = await api.get('/v1/np/compliance/alerts', { params });
    return data;
  },

  async getCourierScore(courierId: number): Promise<CourierComplianceScore> {
    const { data } = await api.get(`/v1/np/compliance/score/${courierId}`);
    return data;
  },

  async bulkNotify(courierIds: number[]): Promise<{ notified: number }> {
    const { data } = await api.post('/v1/np/compliance/bulk-notify', { courierIds });
    return data;
  },
};
