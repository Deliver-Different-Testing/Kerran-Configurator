interface Props {
  label: string;
  value?: string | number;
  type?: 'text' | 'select' | 'date' | 'time' | 'checkbox' | 'textarea' | 'password' | 'email';
  options?: string[];
  readonly?: boolean;
  full?: boolean;
  rows?: number;
  checked?: boolean;
  placeholder?: string;
  warning?: string;
  onChange?: (val: string | boolean) => void;
}

export default function FormField({
  label, value = '', type = 'text', options, readonly, full, rows = 3, checked, placeholder, warning, onChange,
}: Props) {
  const cls = full ? 'col-span-full' : '';

  if (type === 'checkbox') {
    return (
      <div className="flex items-center gap-2 py-1.5 text-sm">
        <input
          type="checkbox"
          checked={checked ?? !!value}
          onChange={(e) => onChange?.(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-brand-cyan focus:ring-brand-cyan focus:ring-offset-0 cursor-pointer"
        />
        <label className="text-text-primary cursor-pointer">{label}</label>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${cls}`}>
      <label className="text-xs text-text-secondary uppercase tracking-wide">{label}</label>
      {type === 'select' ? (
        <select value={String(value)} onChange={(e) => onChange?.(e.target.value)}>
          {options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          rows={rows}
          value={String(value)}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          value={String(value)}
          readOnly={readonly}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className={readonly ? 'opacity-80' : ''}
        />
      )}
      {warning && <div className="text-warning text-xs mt-0.5">{warning}</div>}
    </div>
  );
}
