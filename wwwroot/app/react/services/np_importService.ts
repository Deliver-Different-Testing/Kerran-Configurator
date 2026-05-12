// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
// File-upload import flows aren't usable until the backend is wired —
// keep parsePastedData working for the manual paste path; throw on the rest.

export interface UploadResult {
  columns: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  allRows?: Record<string, string>[];
}

export interface CourierColumnMapping {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  vehicleType?: string;
  licenseRego?: string;
  zones?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}

export interface AiColumnSuggestion {
  systemField: string;
  mappedColumn: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  reasoning: string | null;
}

export interface AiMapResponse {
  suggestions: AiColumnSuggestion[];
  unmappedHeaders: string[];
}

export interface ValidatedCourierRow {
  rowNumber: number;
  data: Record<string, string>;
  status: 'valid' | 'duplicate' | 'error';
  errors: string[];
}

export interface CourierValidationResult {
  rows: ValidatedCourierRow[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface CourierImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  failedRows: { rowNumber: number; data: Record<string, string>; error: string }[];
}

export const courierImportService = {
  uploadFile(_file: File): UploadResult {
    throw new Error('uploadFile() not yet wired to backend');
  },

  aiMapColumns(_headers: string[], _sampleRows: Record<string, string>[]): AiMapResponse {
    return { suggestions: [], unmappedHeaders: [] };
  },

  validate(rows: Record<string, string>[], _mapping: CourierColumnMapping): CourierValidationResult {
    return {
      rows: rows.map((data, i) => ({ rowNumber: i + 1, data, status: 'valid', errors: [] })),
      validCount: rows.length,
      duplicateCount: 0,
      errorCount: 0,
    };
  },

  execute(rows: ValidatedCourierRow[]): CourierImportResult {
    return {
      totalRows: rows.length,
      successCount: 0,
      failedCount: rows.length,
      failedRows: rows.map(r => ({ rowNumber: r.rowNumber, data: r.data, error: 'Backend not yet wired' })),
    };
  },

  parsePastedData(text: string): UploadResult {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('Data must have a header row and at least one data row.');
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const columns = lines[0].split(delimiter).map(c => c.trim());
    const allRows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(delimiter);
      const row: Record<string, string> = {};
      let hasData = false;
      columns.forEach((col, ci) => {
        const val = (fields[ci] || '').trim();
        row[col] = val;
        if (val) hasData = true;
      });
      if (hasData) allRows.push(row);
    }
    return { columns, previewRows: allRows.slice(0, 5), totalRows: allRows.length, allRows };
  },
};
