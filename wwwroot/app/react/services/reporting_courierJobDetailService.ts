import api from './reporting_api';
import { downloadReportFile } from './reporting_download';
import type { ReportFormat } from './reporting_clientMonthlyService';

export interface ReportingCourier {
  id: number;
  code: string;
  name: string;
}

export interface CourierJobDetailParams {
  courierId: number | null;
  from: string; // yyyy-MM-dd
  to: string;   // yyyy-MM-dd
  format: ReportFormat;
}

export const searchCouriers = (q: string, limit = 20) =>
  api.get<ReportingCourier[]>(`/couriers?q=${encodeURIComponent(q)}&limit=${limit}`);

export async function downloadCourierJobDetailReport(p: CourierJobDetailParams, suggestedName: string): Promise<void> {
  await downloadReportFile(
    '/courier-job-detail',
    { courierId: p.courierId ?? undefined, from: p.from, to: p.to, format: p.format },
    suggestedName,
    p.format === 'EXCEL' ? 'xlsx' : 'pdf',
  );
}
