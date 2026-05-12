import { useState, useEffect } from 'react';
import type { AiColumnSuggestion, CourierColumnMapping } from '@/services/np_importService';

interface SystemField {
  key: keyof CourierColumnMapping;
  label: string;
  required: boolean;
}

const SYSTEM_FIELDS: SystemField[] = [
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone / Mobile', required: true },
  { key: 'vehicleType', label: 'Vehicle Type', required: false },
  { key: 'licenseRego', label: 'License / Rego', required: false },
  { key: 'zones', label: 'Zones / Regions', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'emergencyContactName', label: 'Emergency Contact Name', required: false },
  { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

const CONFIDENCE_BADGE: Record<string, { icon: string; color: string; bg: string }> = {
  high: { icon: '🟢', color: 'text-success', bg: 'bg-success/10' },
  medium: { icon: '🟡', color: 'text-warning', bg: 'bg-warning/10' },
  low: { icon: '🔴', color: 'text-error', bg: 'bg-error/10' },
};

interface Props {
  columns: string[];
  previewRows: Record<string, string>[];
  suggestions: AiColumnSuggestion[];
  isThinking: boolean;
  mapping: CourierColumnMapping;
  onMappingChange: (mapping: CourierColumnMapping) => void;
}

export default function AutoMateMapper({
  columns,
  previewRows,
  suggestions,
  isThinking,
  mapping,
  onMappingChange,
}: Props) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  // Animate reveal of suggestions one by one
  useEffect(() => {
    if (suggestions.length === 0 || isThinking) {
      setRevealedFields(new Set());
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      if (i < suggestions.length) {
        setRevealedFields((prev) => new Set([...prev, suggestions[i].systemField]));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [suggestions, isThinking]);

  const setField = (key: keyof CourierColumnMapping, value: string) => {
    onMappingChange({ ...mapping, [key]: value || undefined });
  };

  const getSuggestion = (field: string) => suggestions.find((s) => s.systemField === field);
  const currentRow = previewRows[previewIndex] || {};

  if (isThinking) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        {/* Auto-Mate thinking animation */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-brand-cyan flex items-center justify-center animate-pulse">
            <span className="text-3xl">🤖</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-cyan rounded-full animate-ping" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-text-primary">Auto-Mate is mapping your columns…</p>
          <p className="text-sm text-text-secondary mt-1">Analyzing headers and sample data to find the best matches</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-brand-cyan"
              style={{ animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  const mappedCount = SYSTEM_FIELDS.filter((f) => mapping[f.key]).length;
  const requiredMapped = SYSTEM_FIELDS.filter((f) => f.required && mapping[f.key]).length;
  const requiredTotal = SYSTEM_FIELDS.filter((f) => f.required).length;

  return (
    <div className="space-y-6">
      {/* Auto-Mate header */}
      <div className="bg-brand-cyan/5 rounded-xl p-4 border border-brand-cyan/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-cyan flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-text-primary text-sm">
              Auto-Mate mapped {mappedCount} of {SYSTEM_FIELDS.length} fields
            </p>
            <p className="text-xs text-text-secondary">
              {requiredMapped === requiredTotal
                ? '✅ All required fields mapped — review and adjust if needed'
                : `⚠️ ${requiredTotal - requiredMapped} required field(s) still need mapping`}
            </p>
          </div>
        </div>
      </div>

      {/* Mapping grid */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-0">
          {/* Header */}
          <div className="px-4 py-3 bg-surface-light/50 font-bold text-xs text-text-secondary uppercase tracking-wider">
            System Field
          </div>
          <div className="px-2 py-3 bg-surface-light/50" />
          <div className="px-4 py-3 bg-surface-light/50 font-bold text-xs text-text-secondary uppercase tracking-wider">
            Spreadsheet Column
          </div>
          <div className="px-4 py-3 bg-surface-light/50 font-bold text-xs text-text-secondary uppercase tracking-wider">
            Confidence
          </div>

          {SYSTEM_FIELDS.map((field) => {
            const mapped = mapping[field.key];
            const isMapped = !!mapped;
            const suggestion = getSuggestion(field.key);
            const isRevealed = revealedFields.has(field.key) || revealedFields.size === 0;
            const badge = suggestion ? CONFIDENCE_BADGE[suggestion.confidence] : null;

            return (
              <div
                key={field.key}
                className={`contents transition-all ${isRevealed ? 'opacity-100' : 'opacity-0'}`}
                style={{ transition: 'opacity 0.3s ease' }}
              >
                <div className="px-4 py-3 flex items-center gap-2 border-t border-border/50">
                  <span className={`font-bold text-sm ${field.required ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {field.label}
                  </span>
                  {field.required && <span className="text-error text-xs font-bold">*</span>}
                </div>

                <div className="px-2 py-3 flex items-center border-t border-border/50">
                  {isMapped ? (
                    <span className="text-success text-lg">✓</span>
                  ) : field.required ? (
                    <span className="text-error text-lg">○</span>
                  ) : (
                    <span className="text-text-secondary text-lg">○</span>
                  )}
                </div>

                <div className="px-4 py-2 border-t border-border/50">
                  <select
                    value={mapped || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg transition-all ${
                      isMapped
                        ? 'border-success/30 bg-success/5 border'
                        : 'border border-border bg-surface-light'
                    }`}
                  >
                    <option value="">— Skip —</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div className="px-4 py-3 border-t border-border/50">
                  {suggestion && badge && isMapped ? (
                    <div className="group relative">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.color}`}>
                        {badge.icon} {suggestion.confidenceScore}%
                      </span>
                      {suggestion.reasoning && (
                        <div className="hidden group-hover:block absolute right-0 top-full mt-1 z-10 w-64 p-3 rounded-lg bg-surface-light border border-border shadow-xl text-xs text-text-secondary">
                          🤖 {suggestion.reasoning}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-text-secondary">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-white rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-sm text-text-secondary">Preview Row</h4>
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
              disabled={previewIndex === 0}
              className="px-2 py-1 rounded hover:bg-surface-cream disabled:opacity-30 text-text-secondary"
            >
              ←
            </button>
            <span className="text-text-secondary font-bold">
              {previewIndex + 1} of {previewRows.length}
            </span>
            <button
              onClick={() => setPreviewIndex(Math.min(previewRows.length - 1, previewIndex + 1))}
              disabled={previewIndex >= previewRows.length - 1}
              className="px-2 py-1 rounded hover:bg-surface-cream disabled:opacity-30 text-text-secondary"
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
              <div key={field.key} className="bg-surface-light rounded-lg p-3 border border-border">
                <div className="text-xs text-text-secondary mb-1">{field.label}</div>
                <div className="text-sm font-bold text-text-primary truncate">{value || '—'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
