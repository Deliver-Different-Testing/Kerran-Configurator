import React from 'react';
import type { AssociationType } from '@/types';

interface AssociationBadgeProps {
  association: AssociationType;
}

const styles: Record<AssociationType, { bg: string; text: string; label: string }> = {
  ECA: { bg: 'bg-badge-green-bg', text: 'text-badge-green-text', label: 'ECA' },
  CLDA: { bg: 'bg-badge-blue-bg', text: 'text-badge-blue-text', label: 'CLDA' },
  None: { bg: 'bg-surface-light', text: 'text-text-muted', label: '—' },
};

export function AssociationBadge({ association }: AssociationBadgeProps) {
  if (association === 'None') return <span className="text-text-muted text-sm">—</span>;

  const s = styles[association];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-normal rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
