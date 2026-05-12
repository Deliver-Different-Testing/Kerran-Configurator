import React from 'react';
import type { NpTier } from '@/types';

interface TierBadgeProps {
  tier: NpTier;
}

export function TierBadge({ tier }: TierBadgeProps) {
  const styles = tier === 'Multi-Client'
    ? 'bg-badge-purple-bg text-badge-purple-text'
    : 'bg-badge-blue-bg text-badge-blue-text';

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-normal rounded-full ${styles}`}>
      {tier}
    </span>
  );
}
