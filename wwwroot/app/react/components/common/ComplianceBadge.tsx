interface Props {
  status: 'ok' | 'warning' | 'expired';
}

export default function ComplianceBadge({ status }: Props) {
  const icon = status === 'ok' ? '✅' : status === 'warning' ? '⚠️' : '❌';
  return <span>{icon}</span>;
}
