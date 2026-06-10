import api from './reporting_api';

// Shared report-file download: GETs the endpoint as a blob (cookie auth via the
// reporting axios instance) and triggers a browser download. Throws an Error
// carrying the backend's message (decoded from the blob error body) so pages can
// surface it.
export async function downloadReportFile(
  path: string,
  params: Record<string, string | number | undefined>,
  suggestedName: string,
  ext: 'pdf' | 'xlsx',
): Promise<void> {
  try {
    const res = await api.get(path, { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName.toLowerCase().endsWith(`.${ext}`) ? suggestedName : `${suggestedName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err: unknown) {
    const resp = (err as { response?: { data?: unknown } })?.response;
    let message = 'Report generation failed.';
    if (resp?.data instanceof Blob) {
      try {
        const parsed = JSON.parse(await resp.data.text());
        if (parsed?.error) message = parsed.error;
      } catch {
        // keep generic message
      }
    }
    throw new Error(message);
  }
}
