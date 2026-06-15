import type { ReactNode } from 'react';

// Small shared primitives for the applicant pages, styled with the app's
// existing Tailwind brand tokens (see QuoteResponse for the same palette).

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-lg bg-white border border-border shadow-sm p-6">{children}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
      ⚠️ {message}
    </div>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-md bg-success-bg border border-success/30 px-4 py-3 text-sm text-success">
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}

export function Field({ label, value, onChange, type = 'text', placeholder, required, autoFocus }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-secondary uppercase tracking-wide">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="rounded-md border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}

interface PrimaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className: string;   // theme.accentBtnClass
  children: ReactNode;
}

export function PrimaryButton({ onClick, disabled, className, children }: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2 text-sm font-bold rounded-full disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
