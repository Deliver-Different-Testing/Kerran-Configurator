import api from './reporting_api';

export type ReportFormat = 'PDF' | 'EXCEL';

export interface ClientMonthlyParams {
  clientId: number | null;
  from: string; // yyyy-MM-dd
  to: string;   // yyyy-MM-dd
  format: ReportFormat;
}

// Fetches the generated report as a blob (cookie auth via the reporting axios
// instance) and triggers a browser download. Throws on non-2xx so the page can
// surface a message; the backend error body (a Blob) is decoded for context.
export async function downloadClientMonthlyReport(p: ClientMonthlyParams, suggestedName: string): Promise<void> {
  try {
    const res = await api.get('/client-monthly', {
      params: { clientId: p.clientId ?? undefined, from: p.from, to: p.to, format: p.format },
      responseType: 'blob',
    });

    const ext = p.format === 'EXCEL' ? 'xlsx' : 'pdf';
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName.toLowerCase().endsWith(`.${ext}`) ? suggestedName : `${suggestedName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err: unknown) {
    // Axios puts the (blob) error body on err.response.data — decode it.
    const resp = (err as { response?: { data?: unknown } })?.response;
    if (resp?.data instanceof Blob) {
      try {
        const text = await resp.data.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed?.error || 'Report generation failed.');
      } catch {
        // fall through to generic
      }
    }
    throw new Error('Report generation failed.');
  }
}
