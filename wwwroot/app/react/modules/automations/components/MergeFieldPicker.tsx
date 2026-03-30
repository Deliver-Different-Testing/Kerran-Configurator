import { useState } from 'react';
import { TEMPLATE_FIELDS } from '../types';

interface MergeFieldPickerProps {
  onInsert: (fieldName: string) => void;
}

export function MergeFieldPicker({ onInsert }: MergeFieldPickerProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className="auto-merge-fields">
      <label className="auto-label-text" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Merge Fields
      </label>
      <div className="auto-label-xs" style={{ marginBottom: 8 }}>
        Click a field to insert it at the cursor position
      </div>
      <div className="auto-merge-categories">
        {TEMPLATE_FIELDS.map((group) => (
          <div key={group.category} className="auto-merge-category">
            <button
              type="button"
              className="auto-merge-category-btn"
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === group.category ? null : group.category,
                )
              }
            >
              {group.category}{' '}
              <span className="auto-merge-count">({group.fields.length})</span>
              <span style={{ float: 'right' }}>
                {expandedCategory === group.category ? '\u25B2' : '\u25BC'}
              </span>
            </button>
            {expandedCategory === group.category && (
              <div className="auto-merge-field-list">
                {group.fields.map((field) => (
                  <button
                    key={field}
                    type="button"
                    className="auto-merge-field-btn"
                    onClick={() => onInsert(field)}
                    title={`Insert {${field}}`}
                  >
                    {'{' + field + '}'}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
