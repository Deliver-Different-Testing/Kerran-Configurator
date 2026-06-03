import { useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  id?: string;
  autoComplete?: string;
  /**
   * Operators here are creating a password to read out to a driver they're
   * setting up by hand, so default to showing it. The toggle still lets them
   * hide it (e.g. if someone's looking over their shoulder).
   */
  defaultVisible?: boolean;
}

// Text input with an integrated Show/Hide toggle. Used for operator-facing
// "set this password for the courier" fields (quick-add + Courier Setup), where
// seeing the value is usually wanted because it's being handed to the driver.
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  maxLength,
  id,
  autoComplete = 'new-password',
  defaultVisible = true,
}: Props) {
  const [visible, setVisible] = useState(defaultVisible);
  return (
    <div className="flex items-stretch gap-2">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="flex-1 min-w-0"
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="px-2.5 text-xs text-brand-cyan hover:underline border border-border rounded-md whitespace-nowrap"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
