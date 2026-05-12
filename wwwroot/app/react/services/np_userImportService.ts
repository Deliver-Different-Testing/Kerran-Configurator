// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
import type { UploadResult, AiColumnSuggestion, AiMapResponse } from './np_importService';

export interface UserColumnMapping {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  jobTitle?: string;
  department?: string;
  notes?: string;
}

export interface ValidatedUserRow {
  rowNumber: number;
  data: Record<string, string>;
  status: 'valid' | 'duplicate' | 'error';
  errors: string[];
}

export interface UserValidationResult {
  rows: ValidatedUserRow[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface UserImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  failedRows: { rowNumber: number; data: Record<string, string>; error: string }[];
}

export const userImportService = {
  uploadFile(_file: File): UploadResult {
    throw new Error('uploadFile() not yet wired to backend');
  },

  aiMapColumns(_headers: string[], _sampleRows: Record<string, string>[]): AiMapResponse {
    return { suggestions: [], unmappedHeaders: [] };
  },

  validate(rows: Record<string, string>[], _mapping: UserColumnMapping): UserValidationResult {
    return {
      rows: rows.map((data, i) => ({ rowNumber: i + 1, data, status: 'valid', errors: [] })),
      validCount: rows.length,
      duplicateCount: 0,
      errorCount: 0,
    };
  },

  execute(rows: ValidatedUserRow[]): UserImportResult {
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

export type { UploadResult, AiColumnSuggestion, AiMapResponse };
