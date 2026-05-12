interface Props {
  area: string;
  onRemove: () => void;
}

export default function CoverageTag({ area, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-surface-light border border-border px-3 py-1 rounded-full text-sm m-1 text-text-primary font-medium">
      {area}
      <span onClick={onRemove} className="cursor-pointer text-error text-base leading-none">×</span>
    </span>
  );
}
