import api from './tenant_api';

// Mapped Stops drill-down + Job-detail Speed editing (Recurring Routes spec §5).
// A "stop" is a tblBulkJob. Speed is the only mutable field in v1.

export interface BulkJobListItem {
  id: number;
  jobNumber: string;
  pickup: string;
  drop: string;
  speedId: number;
  speedShortName: string;
  speedName: string;
  speedGroupingId: number;
  speedGroupingName: string | null;
  bookDate: string | null;
  bookTime: string | null;
  statusName: string;
}

export interface BulkJobDetail {
  id: number;
  jobNumber: string;
  customer: string;
  pickupAddress: string;
  dropAddress: string;
  speedId: number;
  speedShortName: string;
  speedName: string;
  speedGroupingId: number;
  speedGroupingName: string | null;
  bookDate: string | null;
  bookTime: string | null;
  linehaulRunName: string | null;
  statusName: string;
  speedEditable: boolean;
  notes: string | null;
}

export const bulkJobService = {
  async listForLinehaulRun(linehaulRunId: number): Promise<BulkJobListItem[]> {
    const { data } = await api.get<BulkJobListItem[]>('/bulk-jobs', { params: { linehaulRunId } });
    return data;
  },
  async getDetail(id: number): Promise<BulkJobDetail> {
    const { data } = await api.get<BulkJobDetail>(`/bulk-jobs/${id}`);
    return data;
  },
  async updateSpeed(id: number, speedId: number): Promise<BulkJobDetail> {
    const { data } = await api.put<BulkJobDetail>(`/bulk-jobs/${id}/speed`, { speedId });
    return data;
  },
};
