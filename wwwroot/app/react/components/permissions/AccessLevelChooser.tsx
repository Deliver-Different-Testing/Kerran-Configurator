// Unified Permissions §8.3.3 — explicit access-level chooser.
//
// A 4-segment control [ None | View | Edit | Action ] replacing the older
// cycling pill. The user clicks the level they want directly (no cycling),
// which is the control Steve asked for in ROLE_PERMISSIONS_LEVEL_CHOOSER.
//
//   • Segments above the node's `accessType` cap are greyed/disabled — a
//     view-only permission can't be granted Edit/Action; None is always
//     available (deny). (accessType ladder: 1=View, 2=Edit, 3=Action.)
//   • The current `level` segment is highlighted: SOLID in its level colour
//     when set explicitly on this row, FAINT when inherited via cascade from
//     a parent tile. Clicking a lower segment on a child = explicit downgrade.
//   • Clicking any enabled segment fires onChange immediately (optimistic
//     save handled by the caller).
//
// Shared by the Role × Permission matrix grid and the Edit Role modal.
import { ACCESS_LABEL, clampAccess, type AccessLevel } from '@/data/accessLevels';

const SEGMENTS: AccessLevel[] = [0, 1, 2, 3];

// Solid fill for an explicitly-set level (its own colour per the legend).
const SOLID: Record<AccessLevel, string> = {
  0: 'bg-gray-400 text-white',
  1: 'bg-[#3bc7f4] text-white',     // View — brand cyan
  2: 'bg-emerald-500 text-white',   // Edit — green
  3: 'bg-purple-500 text-white',    // Action — purple
};

// Faint tint for an inherited level (cascaded from a parent tile, not set here).
const FAINT: Record<AccessLevel, string> = {
  0: 'bg-gray-100 text-gray-500',
  1: 'bg-[#3bc7f4]/15 text-[#1b9fd0]',
  2: 'bg-emerald-100 text-emerald-700',
  3: 'bg-purple-100 text-purple-700',
};

interface Props {
  /** Resolved level to display as current (own explicit value, or inherited). */
  level: number | null;
  /** Max level this node supports (1=View, 2=Edit, 3=Action) — caps the segments. */
  accessType: number;
  /** true when `level` is set explicitly on this row (vs inherited via cascade). */
  explicit?: boolean;
  busy?: boolean;
  label?: string;
  onChange: (next: AccessLevel) => void;
}

export default function AccessLevelChooser({ level, accessType, explicit, busy, label, onChange }: Props) {
  const current = clampAccess(level);
  const max = Math.min(3, Math.max(1, accessType)) as AccessLevel;

  return (
    <div
      role="group"
      aria-label={label}
      title={label}
      className={`inline-flex rounded-full border border-gray-300 overflow-hidden text-[11px] font-semibold leading-none ${busy ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {SEGMENTS.map(seg => {
        const selected = seg === current;
        const disabled = busy || seg > max;     // None(0)/View(1) always within max>=1
        const cls = disabled
          ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
          : selected
            ? `${explicit ? SOLID[seg] : FAINT[seg]} cursor-pointer`
            : 'bg-white text-text-secondary hover:bg-gray-100 cursor-pointer';
        return (
          <button
            key={seg}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            title={disabled && seg > max ? `${ACCESS_LABEL[seg]} — not available for this item` : ACCESS_LABEL[seg]}
            onClick={() => { if (!disabled) onChange(seg); }}
            className={`px-2.5 py-1 transition-colors focus:outline-none focus:relative focus:z-10 focus:ring-2 focus:ring-[#3bc7f4]/40 ${seg !== 0 ? 'border-l border-gray-300' : ''} ${cls}`}
          >
            {ACCESS_LABEL[seg]}
          </button>
        );
      })}
    </div>
  );
}
