interface Props {
  icon: string;
  label: string;
  onClick: () => void;
  external?: boolean;
}

export default function QuickAction({ icon, label, onClick, external }: Props) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-border rounded-lg px-5 py-4 cursor-pointer transition-all duration-200 hover:border-brand-cyan hover:-translate-y-px hover:shadow-sm flex items-center gap-2.5 text-sm text-text-primary"
    >
      {icon} {label}
      {external && (
        <span className="ml-auto text-[10px] bg-brand-cyan/10 text-brand-cyan px-1.5 py-0.5 rounded">
          External
        </span>
      )}
    </div>
  );
}
