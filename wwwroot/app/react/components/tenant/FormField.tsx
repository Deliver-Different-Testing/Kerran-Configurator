import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children?: React.ReactNode;
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export function FormField({
  label,
  error,
  required,
  children,
  type = 'text',
  value,
  onChange,
  placeholder,
  options,
}: FormFieldProps) {
  const inputClasses =
    'w-full px-3.5 py-2.5 text-base border-2 border-border rounded-[8px] bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all';

  return (
    <div className="mb-4">
      <label className="block text-sm font-normal text-text-secondary mb-1">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children ? (
        children
      ) : options ? (
        <select value={value} onChange={onChange} className={inputClasses}>
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputClasses} min-h-[80px] resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputClasses}
        />
      )}
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
