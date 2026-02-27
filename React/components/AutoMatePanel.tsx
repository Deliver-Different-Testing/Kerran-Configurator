import React, { useState } from 'react';
import { workflowApi } from '../services/api';
import type { WorkflowNlpResponse, WorkflowNlpStepDto, WorkflowTemplateDetailDto } from '../types';

interface AutoMatePanelProps {
  onApply: (result: WorkflowNlpResponse) => void;
  currentSteps: WorkflowTemplateDetailDto[];
}

export const AutoMatePanel: React.FC<AutoMatePanelProps> = ({ onApply, currentSteps }) => {
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState<WorkflowNlpResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!instruction.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const res = await workflowApi.parseNlp(instruction);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = () => {
    if (currentSteps.length === 0) {
      setResult(null);
      setInstruction('');
      setError('No steps in the current workflow to explain.');
      return;
    }

    const explanation = currentSteps
      .filter((s) => s.isActive)
      .sort((a, b) => a.sequence - b.sequence)
      .map((s, i) => `${i + 1}. ${s.eventTypeName || `Step ${s.eventTypeId}`} (at ${s.statusName})`)
      .join('\n');

    setInstruction(
      `This workflow has ${currentSteps.length} step(s):\n${explanation}`
    );
  };

  return (
    <div className="auto-mate-panel card bg-light mb-3">
      <div className="card-body">
        <div className="d-flex align-items-center mb-2">
          <span className="me-2" style={{ fontSize: '1.5em' }}>🤖</span>
          <div>
            <strong>Auto-Mate</strong>
            <br />
            <small className="text-muted">
              Describe your workflow in plain English and I'll build it for you!
            </small>
          </div>
        </div>

        <div className="mb-2">
          <textarea
            className="form-control"
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "For express deliveries, scan barcode at pickup, capture signature and photo at delivery"'
          />
        </div>

        <div className="d-flex gap-2 mb-3">
          <button
            className="btn btn-sm btn-primary"
            onClick={handleParse}
            disabled={loading || !instruction.trim()}
          >
            {loading ? '🔄 Parsing...' : '✨ Parse Workflow'}
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={handleExplain}
            disabled={currentSteps.length === 0}
          >
            📖 Explain Current Workflow
          </button>
        </div>

        {error && <div className="alert alert-warning py-1">{error}</div>}

        {result && result.success && (
          <div className="border rounded p-2 bg-white">
            <h6 className="mb-1">
              📋 {result.suggestedName}
              {result.clientScope && (
                <span className="badge bg-info ms-2">Client: {result.clientScope}</span>
              )}
              {result.serviceScope && (
                <span className="badge bg-warning ms-2">Service: {result.serviceScope}</span>
              )}
            </h6>
            <p className="text-muted small mb-2">{result.explanation}</p>

            {result.steps.length > 0 && (
              <table className="table table-sm mb-2">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Event Type</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {result.steps.map((s: WorkflowNlpStepDto) => (
                    <tr key={s.sequence}>
                      <td>{s.sequence}</td>
                      <td>
                        {s.eventTypeName}
                        {s.eventTypeId && (
                          <small className="text-muted ms-1">(#{s.eventTypeId})</small>
                        )}
                      </td>
                      <td>{s.stageTrigger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button
              className="btn btn-sm btn-success"
              onClick={() => onApply(result)}
            >
              ✅ Apply to Editor
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoMatePanel;
