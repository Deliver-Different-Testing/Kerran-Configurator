import React from 'react';

type StatusVariant = 'active' | 'inactive' | 'pending' | 'suspended' | 'compliant' | 'expiring' | 'non-compliant' | 'open' | 'quoted' | 'awarded' | 'closed';

const variantStyles: Record<StatusVariant, string> = {
  active: 'bg-success-bg text-success',
  inactive: 'bg-surface-light text-text-muted',
  pending: 'bg-warning-bg text-warning',
  suspended: 'bg-error-bg text-error',
  compliant: 'bg-success-bg text-success',
  expiring: 'bg-warning-bg text-warning',
  'non-compliant': 'bg-error-bg text-error',
  open: 'bg-badge-blue-bg text-badge-blue-text',
  quoted: 'bg-badge-purple-bg text-badge-purple-text',
  awarded: 'bg-success-bg text-success',
  closed: 'bg-surface-light text-text-muted',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const key = status.toLowerCase().replace(/[ _]/g, '-') as StatusVariant;
  const styles = variantStyles[key] || 'bg-surface-light text-text-secondary';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-normal rounded-full ${styles} ${className}`}>
      {status}
    </span>
  );
}
