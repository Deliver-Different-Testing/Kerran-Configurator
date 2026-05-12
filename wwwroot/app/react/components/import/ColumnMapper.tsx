import React, { useEffect, useState } from 'react';
import type { ColumnMapping, MappingTemplate } from '@/services/tenant_importService';
import { importService } from '@/services/tenant_importService';

interface SystemField {
  key: keyof ColumnMapping;
  label: string;
  required: boolean;
}

const SYSTEM_FIELDS: SystemField[] = [
  { key: 'name', label: 'Agent Name', required: true },
  { key: 'address', label: 'Address', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State / Region', required: false },
  { key: 'postCode', label: 'Post Code', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'serviceTypes', label: 'Service Types', required: false },
  { key: 'equipment', label: 'Equipment', required: false },
  { key: 'certifications', label: 'Certifications', required: false },
  { key: 'association', label: 'Association', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

// Common header synonyms for auto-mapping
const AUTO_MAP: Record<string, string[]> = {
  name: ['name', 'company', 'company name', 'agent', 'agent name', 'business name', 'carrier'],
  address: ['address', 'street', 'street address', 'address1', 'address 1'],
  city: ['city', 'suburb', 'town', 'locality'],
  state: ['state', 'region', 'province', 'state/region'],
  postCode: ['postcode', 'post code', 'zip', 'zip code', 'postal code', 'postal'],
  phone: ['phone', 'telephone', 'phone number', 'tel', 'mobile', 'cell'],
  email: ['email', 'email address', 'e-mail', 'contact email'],
  serviceTypes: ['services', 'service types', 'service type', 'service'],
  equipment: ['equipment', 'vehicles', 'fleet', 'vehicle types'],
  certifications: ['certifications', 'certs', 'qualifications', 'accreditations'],
  association: ['association', 'member of', 'membership'],
  notes: ['notes', 'comments', 'remarks', 'description'],
};

interface ColumnMapperProps {
  columns: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

export function ColumnMapper({ columns, previewRows, totalRows, mapping, onMappingChange }: ColumnMapperProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [templateName, setTemplateName] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templates] = useState<MappingTemplate[]>(() => importService.getTemplates());

  // Auto-map on mount if mapping is empty
  useEffect(() => {
    const hasMapping = Object.values(mapping).some((v) => v);
    if (!hasMapping && columns.length > 0) {
      autoMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoMap = () => {
    const newMapping: Record<string, string> = {};
    const lowerColumns = columns.map((c) => c.toLowerCase().trim());

    for (const [field, synonyms] of Object.entries(AUTO_MAP)) {
      for (const syn of synonyms) {
        const idx = lowerColumns.findIndex((c) => c === syn || c.includes(syn));
        if (idx !== -1 && !Object.values(newMapping).includes(columns[idx])) {
          newMapping[field] = columns[idx];
          break;
        }
      }
    }

    onMappingChange(newMapping as ColumnMapping);
  };

  const loadTemplate = (name: string) => {
    const t = templates.find((t) => t.name === name);
    if (t) onMappingChange(t.mapping);
  };

  const handleSaveTemplate = () => {
    if (templateName.trim()) {
      importService.saveTemplate({ name: templateName.trim(), mapping });
      setSaveAsTemplate(false);
      setTemplateName('');
    }
  };

  const setField = (key: keyof ColumnMapping, value: string) => {
    onMappingChange({ ...mapping, [key]: value || undefined });
  };

  const currentRow = previewRows[previewIndex] || {};

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={autoMap}
          className="px-4 py-2 text-sm font-bold rounded-full bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 transition-all"
        >
          ✨ Auto-Map
        </button>

        {templates.length > 0 && (
          <select
            onChange={(e) => e.target.value && loadTemplate(e.target.value)}
            className="px-3 py-2 text-sm border-2 border-border rounded-full bg-white text-text-primary focus:outline-none focus:border-brand-cyan"
            defaultValue=""
          >
            <option value="">Load Template…</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 text-sm text-text-secondary ml-auto">
          <input
            type="checkbox"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
            className="rounded border-border text-brand-cyan focus:ring-brand-cyan"
          />
          Save as Template
        </label>

        {saveAsTemplate && (
          <div className="flex gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              className="px-3 py-1.5 text-sm border-2 border-border rounded-lg focus:outline-none focus:border-brand-cyan"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
              className="px-3 py-1.5 text-sm font-bold rounded-lg bg-success text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Mapping grid */}
      <div className="bg-white rounded-lg border-2 border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 divide-y divide-border">
          {/* Header */}
          <div className="px-4 py-3 bg-surface-light font-bold text-sm text-text-secondary">System Field</div>
          <div className="px-2 py-3 bg-surface-light" />
          <div className="px-4 py-3 bg-surface-light font-bold text-sm text-text-secondary">Spreadsheet Column</div>

          {SYSTEM_FIELDS.map((field) => {
            const mapped = mapping[field.key];
            const isMapped = !!mapped;

            return (
              <React.Fragment key={field.key}>
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className={`font-bold text-sm ${field.required ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {field.label}
                  </span>
                  {field.required && <span className="text-danger text-xs font-bold">*</span>}
                </div>
                <div className="px-2 py-3 flex items-center">
                  {isMapped ? (
                    <span className="text-success text-lg">✓</span>
                  ) : field.required ? (
                    <span className="text-danger text-lg">○</span>
                  ) : (
                    <span className="text-text-muted text-lg">○</span>
                  )}
                </div>
                <div className="px-4 py-2">
                  <select
                    value={mapped || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:border-brand-cyan transition-all ${
                      isMapped ? 'border-success/30 bg-success/5' : 'border-border bg-white'
                    }`}
                  >
                    <option value="">— Skip —</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-surface-light rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-sm text-text-secondary">Preview Row</h4>
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
              disabled={previewIndex === 0}
              className="px-2 py-1 rounded hover:bg-white disabled:opacity-30 transition-all"
            >
              ←
            </button>
            <span className="text-text-muted font-bold">
              {previewIndex + 1} of {Math.min(previewRows.length, totalRows)}
            </span>
            <button
              onClick={() => setPreviewIndex(Math.min(previewRows.length - 1, previewIndex + 1))}
              disabled={previewIndex >= previewRows.length - 1}
              className="px-2 py-1 rounded hover:bg-white disabled:opacity-30 transition-all"
            >
              →
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {SYSTEM_FIELDS.filter((f) => mapping[f.key]).map((field) => {
            const col = mapping[field.key]!;
            const value = currentRow[col] || '';
            return (
              <div key={field.key} className="bg-white rounded-lg p-3 border border-border">
                <div className="text-xs text-text-muted mb-1">{field.label}</div>
                <div className="text-sm font-bold text-text-primary truncate">{value || '—'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
