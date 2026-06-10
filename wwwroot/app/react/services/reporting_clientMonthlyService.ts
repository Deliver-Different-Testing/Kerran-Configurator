import { downloadReportFile } from './reporting_download';

export type ReportFormat = 'PDF' | 'EXCEL';

export interface ClientMonthlyParams {
  clientId: number | null;
  from: string; // yyyy-MM-dd
  to: string;   // yyyy-MM-dd
  format: ReportFormat;
}

export async function downloadClientMonthlyReport(p: ClientMonthlyParams, suggestedName: string): Promise<void> {
  await downloadReportFile(
    '/client-monthly',
    { clientId: p.clientId ?? undefined, from: p.from, to: p.to, format: p.format },
    suggestedName,
    p.format === 'EXCEL' ? 'xlsx' : 'pdf',
  );
}
