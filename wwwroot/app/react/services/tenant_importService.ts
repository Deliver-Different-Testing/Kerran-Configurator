// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
// Tenant agent-import — file-upload flows aren't usable until the backend
// is wired; the manual paste path stays functional for UX validation.

export interface UploadResult {
  columns: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
}

export interface ColumnMapping {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postCode?: string;
  phone?: string;
  email?: string;
  serviceTypes?: string;
  equipment?: string;
  certifications?: string;
  association?: string;
  notes?: string;
}

export interface ProspectAgentMatch {
  prospectAgentId: number;
  companyName: string;
  association: string;
  memberId?: string;
  city?: string;
  state?: string;
  services?: string;
  equipment?: string;
  certifications?: string;
}

export interface ValidatedRow {
  rowNumber: number;
  data: Record<string, string>;
  status: 'valid' | 'duplicate' | 'association_match' | 'error';
  errors: string[];
  associationMatch?: ProspectAgentMatch;
}

export interface ValidationResult {
  rows: ValidatedRow[];
  duplicateCount: number;
  associationMatchCount: number;
  errorCount: number;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  failedRows: { rowNumber: number; data: Record<string, string>; error: string }[];
}

export interface MappingTemplate {
  name: string;
  mapping: ColumnMapping;
}

const TEMPLATES_KEY = 'agent_import_templates';

export const importService = {
  uploadFile(_file: File): UploadResult {
    throw new Error('uploadFile() not yet wired to backend');
  },

  importGoogleSheet(_fileId: string, _accessToken?: string): UploadResult {
    throw new Error('importGoogleSheet() not yet wired to backend');
  },

  validate(rows: Record<string, string>[], _mapping: ColumnMapping): ValidationResult {
    return {
      rows: rows.map((data, i) => ({ rowNumber: i + 1, data, status: 'valid', errors: [] })),
      duplicateCount: 0,
      associationMatchCount: 0,
      errorCount: 0,
    };
  },

  execute(rows: ValidatedRow[]): ImportResult {
    return {
      totalRows: rows.length,
      successCount: 0,
      failedCount: rows.length,
      failedRows: rows.map(r => ({ rowNumber: r.rowNumber, data: r.data, error: 'Backend not yet wired' })),
    };
  },

  getTemplates(): MappingTemplate[] {
    try {
      return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    } catch {
      return [];
    }
  },

  saveTemplate(template: MappingTemplate) {
    const templates = this.getTemplates().filter(t => t.name !== template.name);
    templates.push(template);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  },

  deleteTemplate(name: string) {
    const templates = this.getTemplates().filter(t => t.name !== name);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  },

  parsePastedData(text: string): UploadResult {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('Pasted data must have a header row and at least one data row.');
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
    return { columns, previewRows: allRows.slice(0, 5), totalRows: allRows.length };
  },

  extractGoogleSheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  },
};
