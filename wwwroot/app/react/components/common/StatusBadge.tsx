interface Props {
  status: 'active' | 'inactive';
  label?: string;
}

export default function StatusBadge({ status, label }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`inline-block w-2 h-2 rounded-full ${status === 'active' ? 'bg-success' : 'bg-error'}`} />
      {label ?? (status === 'active' ? 'Active' : 'Inactive')}
    </span>
  );
}
