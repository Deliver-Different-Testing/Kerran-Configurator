// Unified Permissions §8.3.3 — tri-state (quad) access pill. Click cycles
// None -> View -> Edit -> Action -> None (skipping levels above the node's
// accessType). Shared by the Role Permissions grid and the Role modal.
import { ACCESS_LABEL, ACCESS_PILL_CLASS, cycleAccess, clampAccess, type AccessLevel } from '@/data/accessLevels';

interface Props {
  level: number | null;
  accessType: number;
  busy?: boolean;
  /** true when this cell is set explicitly (not inherited via cascade) —
   *  renders the §8.3.2 "not inherited" dot. */
  explicit?: boolean;
  label?: string;
  onChange: (next: AccessLevel) => void;
}

export default function TriStateCell({ level, accessType, busy, explicit, label, onChange }: Props) {
  const lvl = clampAccess(level);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={() => onChange(cycleAccess(lvl, accessType))}
      className={`relative inline-flex items-center justify-center min-w-[68px] px-3 py-1 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40 ${ACCESS_PILL_CLASS[lvl]} ${busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {ACCESS_LABEL[lvl]}
      {explicit && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white"
          title="Explicitly set (not inherited)"
        />
      )}
    </button>
  );
}
