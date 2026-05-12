interface Props {
  label: string;
  value: string | number;
  color?: 'cyan' | 'green' | 'amber' | 'default';
  note?: string;
  onClick?: () => void;
  active?: boolean;
}

const colorMap = {
  cyan: 'text-brand-cyan',
  green: 'text-success',
  amber: 'text-warning',
  default: 'text-text-primary',
};

const activeBorderMap: Record<string, string> = {
  cyan: 'ring-2 ring-brand-cyan border-brand-cyan',
  green: 'ring-2 ring-green-500 border-green-500',
  amber: 'ring-2 ring-amber-500 border-amber-500',
  default: 'ring-2 ring-gray-400 border-gray-400',
};

export default function StatCard({ label, value, color = 'default', note, onClick, active }: Props) {
  return (
    <div
      className={`bg-white border border-border rounded-lg p-5 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:shadow-lg' : ''
      } ${active ? activeBorderMap[color] || activeBorderMap.default : ''}`}
      onClick={onClick}
    >
      <div className="text-sm text-text-secondary mb-1">{label}</div>
      <div className={`text-[28px] font-bold ${colorMap[color]}`}>{value}</div>
      {note && <div className="text-xs text-text-muted mt-1">{note}</div>}
    </div>
  );
}
