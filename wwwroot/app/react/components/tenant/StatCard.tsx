import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: 'cyan' | 'green' | 'orange' | 'purple' | 'default';
  icon?: string;
}

const colorMap = {
  cyan: 'text-brand-cyan',
  green: 'text-success',
  orange: 'text-warning',
  purple: 'text-brand-purple',
  default: 'text-text-primary',
};

export function StatCard({ label, value, color = 'default', icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 text-center">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <div className={`text-4xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-sm text-text-muted font-normal mt-1">{label}</div>
    </div>
  );
}
