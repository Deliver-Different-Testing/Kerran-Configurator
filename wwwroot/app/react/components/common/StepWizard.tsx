interface Props {
  steps: string[];
  current: number;
}

export default function StepWizard({ steps, current }: Props) {
  return (
    <div className="flex gap-0 mb-6">
      {steps.map((step, i) => {
        const num = i + 1;
        const isActive = current === num;
        const isDone = current > num;
        return (
          <div
            key={step}
            className={`flex-1 text-center py-3 text-sm border-b-2 ${
              isActive ? 'text-brand-cyan border-brand-cyan' :
              isDone ? 'text-success border-success' :
              'text-text-muted border-border'
            }`}
          >
            <span className={`inline-block w-6 h-6 rounded-full leading-6 text-xs mr-1.5 ${
              isActive ? 'bg-brand-cyan text-brand-dark' :
              isDone ? 'bg-success text-white' :
              'bg-border text-text-muted'
            }`}>
              {isDone ? '✓' : num}
            </span>
            {step}
          </div>
        );
      })}
    </div>
  );
}
