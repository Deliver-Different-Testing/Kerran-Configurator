interface Props {
  tier?: string | null;
  className?: string;
}

export default function TierBadge({ tier, className = '' }: Props) {
  const label = tier ? `${tier} NP` : 'Base NP';
  return (
    <span className={`inline-block bg-brand-cyan/10 text-brand-cyan text-xs px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}
