import React from 'react';

interface Step {
  label: string;
  content: React.ReactNode;
}

interface StepWizardProps {
  steps: Step[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  canProceed?: boolean;
}

export function StepWizard({ steps, currentStep, onNext, onPrev, onSubmit, canProceed = true }: StepWizardProps) {
  const isLast = currentStep === steps.length - 1;

  return (
    <div>
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < currentStep
                    ? 'bg-success text-white'
                    : i === currentStep
                    ? 'bg-brand-cyan text-brand-dark'
                    : 'bg-surface-light text-text-muted'
                }`}
              >
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span
                className={`text-sm font-bold ${
                  i === currentStep ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < currentStep ? 'bg-success' : 'bg-border-light'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="mb-8">{steps[currentStep].content}</div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onPrev}
          disabled={currentStep === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 font-bold rounded-full text-base transition-all bg-white text-text-secondary border-2 border-border hover:bg-surface-light disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          onClick={isLast ? onSubmit : onNext}
          disabled={!canProceed}
          className="inline-flex items-center gap-2 px-5 py-2.5 font-bold rounded-full text-base transition-all bg-brand-cyan text-brand-dark hover:shadow-cyan-glow hover:-translate-y-px active:translate-y-0 disabled:opacity-50"
        >
          {isLast ? 'Create Partner' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
