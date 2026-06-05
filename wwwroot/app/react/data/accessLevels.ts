// Unified Permissions — the graded access ladder (spec §4.2/§8.3.3).
// One canonical ladder for both Permission.AccessType (max a node supports)
// and RolePermission.AccessLevel (what a role is granted).

export const ACCESS = {
  None: 0,
  View: 1,
  Edit: 2,
  Action: 3,
} as const;

export type AccessLevel = 0 | 1 | 2 | 3;

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  0: 'None',
  1: 'View',
  2: 'Edit',
  3: 'Action',
};

// Pill styling per level (matches the spec §8.3.3 colour table).
export const ACCESS_PILL_CLASS: Record<AccessLevel, string> = {
  0: 'bg-transparent text-text-muted border border-gray-300',
  1: 'bg-[#3bc7f4] text-white border border-transparent',     // View — blue
  2: 'bg-emerald-500 text-white border border-transparent',   // Edit — green
  3: 'bg-purple-500 text-white border border-transparent',    // Action — purple
};

// Cycle forward None -> View -> Edit -> Action -> None, but skip past any
// level above what the node supports (accessType). A View-only node cycles
// None <-> View; an Edit node cycles None -> View -> Edit -> None; an Action
// node cycles through all four.
export function cycleAccess(current: AccessLevel, accessType: number): AccessLevel {
  const max = Math.min(3, Math.max(1, accessType)) as AccessLevel;
  const next = current + 1;
  return (next > max ? 0 : next) as AccessLevel;
}

export function clampAccess(level: number | null | undefined): AccessLevel {
  if (level == null || level < 0) return 0;
  if (level > 3) return 3;
  return level as AccessLevel;
}
