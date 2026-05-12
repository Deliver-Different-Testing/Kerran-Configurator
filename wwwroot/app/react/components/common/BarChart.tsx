interface Props {
  data: { label: string; value: number }[];
}

export default function BarChart({ data }: Props) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div className="flex items-end gap-2 h-40 pt-2">
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-text-primary">{d.value}</span>
          <div
            className="bg-brand-cyan rounded-t w-full min-w-[20px] transition-[height] duration-300"
            style={{ height: `${(d.value / max) * 130}px` }}
          />
          <span className="text-xs text-text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
