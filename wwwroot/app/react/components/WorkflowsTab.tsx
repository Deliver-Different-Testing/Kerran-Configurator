import React, { useEffect, useState, useCallback } from 'react';
import { workflowApi } from '../services/api';
import type { WorkflowTemplateDto, WorkflowTemplateDetailDto, AccessorialWorkflowTaskDto } from '../types';
import { STAGE_ID_NAMES } from '../types';
import { AutoMatePanel } from './AutoMatePanel';

const STAGES = ['Enroute to Pickup', 'Pickup', 'Enroute to Delivery', 'Delivery'] as const;

export const WorkflowsTab: React.FC = () => {
  const [templates, setTemplates] = useState<WorkflowTemplateDto[]>([]);
  const [selected, setSelected] = useState<WorkflowTemplateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAutoMate, setShowAutoMate] = useState(false);

  // Editor state
  const [editorName, setEditorName] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorClientId, setEditorClientId] = useState<number | null>(null);
  const [editorSpeedId, setEditorSpeedId] = useState<number | null>(null);
  const [editorActive, setEditorActive] = useState(true);
  const [editorMirrorToAgentPortal, setEditorMirrorToAgentPortal] = useState(false);
  const [editorSteps, setEditorSteps] = useState<WorkflowTemplateDetailDto[]>([]);

  // Lookups
  const [eventTypes, setEventTypes] = useState<{ id: number; name: string }[]>([]);
  const [jobStatuses, setJobStatuses] = useState<{ id: number; name: string }[]>([]);

  // Accessorial mapping state
  const [activeSubTab, setActiveSubTab] = useState<'steps' | 'accessorial'>('steps');
  const [accessorialMappings, setAccessorialMappings] = useState<AccessorialWorkflowTaskDto[]>([]);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const [templatesRes, lookupsRes] = await Promise.all([
        workflowApi.getAll(),
        workflowApi.getLookups(),
      ]);
      setTemplates(templatesRes.templates || []);
      setEventTypes(lookupsRes.eventTypes || []);
      setJobStatuses(lookupsRes.jobStatuses || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const selectTemplate = (t: WorkflowTemplateDto) => {
    setSelected(t);
    setEditorName(t.name);
    setEditorDescription(t.description || '');
    setEditorClientId(t.clientId);
    setEditorSpeedId(t.speedId);
    setEditorActive(t.isActive);
    setEditorMirrorToAgentPortal(t.mirrorToAgentPortal || false);
    setEditorSteps([...t.details]);
    setShowAutoMate(false);
    setActiveSubTab('steps');
  };

  const newTemplate = () => {
    setSelected(null);
    setEditorName('');
    setEditorDescription('');
    setEditorClientId(null);
    setEditorSpeedId(null);
    setEditorActive(true);
    setEditorMirrorToAgentPortal(false);
    setEditorSteps([]);
    setActiveSubTab('steps');
  };

  const addStep = () => {
    const nextSeq = editorSteps.length > 0
      ? Math.max(...editorSteps.map((s) => s.sequence)) + 1
      : 1;
    const defaultStatus = jobStatuses[0];
    const defaultEventType = eventTypes[0];
    setEditorSteps([
      ...editorSteps,
      {
        id: 0,
        templateId: selected?.id || 0,
        statusId: defaultStatus?.id || 0,
        statusName: defaultStatus?.name || '',
        eventTypeId: defaultEventType?.id || 0,
        eventTypeName: defaultEventType?.name || '',
        timeOffset: 0,
        sequence: nextSeq,
        isActive: true,
      },
    ]);
  };

  const removeStep = (index: number) => {
    setEditorSteps(editorSteps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newSteps = [...editorSteps];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    // Renumber sequences
    newSteps.forEach((s, i) => (s.sequence = i + 1));
    setEditorSteps(newSteps);
  };

  const updateStep = (index: number, field: string, value: any) => {
    setEditorSteps(
      editorSteps.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        name: editorName,
        description: editorDescription || null,
        clientId: editorClientId,
        speedId: editorSpeedId,
        isActive: editorActive,
        mirrorToAgentPortal: editorMirrorToAgentPortal,
        details: editorSteps.map((s) => ({
          statusId: s.statusId,
          eventTypeId: s.eventTypeId,
          timeOffset: s.timeOffset,
          sequence: s.sequence,
          isActive: s.isActive,
        })),
      };

      if (selected) {
        await workflowApi.update(selected.id, payload);
      } else {
        await workflowApi.create(payload);
      }

      await loadTemplates();
      newTemplate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selected) return;
    if (!window.confirm(`Deactivate workflow "${selected.name}"?`)) return;
    try {
      await workflowApi.delete(selected.id);
      await loadTemplates();
      newTemplate();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Called by AutoMatePanel to populate editor from NLP result
  const applyNlpResult = (result: any) => {
    if (result.suggestedName) setEditorName(result.suggestedName);
    if (result.steps) {
      setEditorSteps(
        result.steps.map((s: any, i: number) => ({
          id: 0,
          templateId: 0,
          statusId: s.statusId || 0,
          statusName: s.stageTrigger || 'Delivery',
          eventTypeId: s.eventTypeId || 0,
          eventTypeName: s.eventTypeName || '',
          timeOffset: s.timeOffset || 0,
          sequence: i + 1,
          isActive: true,
        }))
      );
    }
    setShowAutoMate(false);
  };

  if (loading) return <div className="text-center p-4">Loading workflows...</div>;

  return (
    <div className="workflows-tab">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row">
        {/* Template list */}
        <div className="col-md-4">
          <div className="d-flex justify-content-between mb-2">
            <h6>Templates</h6>
            <button className="btn btn-sm btn-success" onClick={newTemplate}>
              + New
            </button>
          </div>
          <div className="list-group">
            {templates.map((t) => (
              <button
                key={t.id}
                className={`list-group-item list-group-item-action ${
                  selected?.id === t.id ? 'active' : ''
                }`}
                onClick={() => selectTemplate(t)}
              >
                <div className="d-flex justify-content-between">
                  <span>{t.name}</span>
                  <span className={`badge ${t.isActive ? 'bg-success' : 'bg-secondary'}`}>
                    {t.scopeLabel}
                  </span>
                </div>
                <small>{t.stepCount} step(s)</small>
              </button>
            ))}
            {templates.length === 0 && (
              <div className="text-muted text-center p-3">No workflow templates yet.</div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="col-md-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                {selected ? `Edit: ${selected.name}` : 'New Workflow Template'}
              </h6>
              <button
                className="btn btn-sm btn-outline-info"
                onClick={() => setShowAutoMate(!showAutoMate)}
              >
                Auto-Mate
              </button>
            </div>
            <div className="card-body">
              {showAutoMate && (
                <AutoMatePanel
                  onApply={applyNlpResult}
                  currentSteps={editorSteps}
                />
              )}

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Template Name</label>
                  <input
                    className="form-control"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                    placeholder="e.g. Standard Delivery Workflow"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Client ID</label>
                  <input
                    className="form-control"
                    type="number"
                    value={editorClientId ?? ''}
                    onChange={(e) =>
                      setEditorClientId(e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder="(any)"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Service ID</label>
                  <input
                    className="form-control"
                    type="number"
                    value={editorSpeedId ?? ''}
                    onChange={(e) =>
                      setEditorSpeedId(e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder="(any)"
                  />
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-9">
                  <label className="form-label">Description</label>
                  <input
                    className="form-control"
                    value={editorDescription}
                    onChange={(e) => setEditorDescription(e.target.value)}
                  />
                </div>
                <div className="col-md-3 d-flex align-items-end gap-3">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={editorActive}
                      onChange={(e) => setEditorActive(e.target.checked)}
                    />
                    <label className="form-check-label">Active</label>
                  </div>
                  <div className="form-check form-switch" title="When enabled, this workflow is also visible in the Agent Portal so Network Partners see the same steps">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={editorMirrorToAgentPortal}
                      onChange={(e) => setEditorMirrorToAgentPortal(e.target.checked)}
                    />
                    <label className="form-check-label">Mirror to Agent Portal</label>
                  </div>
                </div>
              </div>

              {/* Sub-tab navigation */}
              <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeSubTab === 'steps' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('steps')}
                  >
                    Workflow Steps
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeSubTab === 'accessorial' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('accessorial')}
                  >
                    Accessorial Mapping
                  </button>
                </li>
              </ul>

              {activeSubTab === 'accessorial' && (
                <div className="accessorial-mapping mb-3">
                  <div className="alert alert-info">
                    <strong>Accessorial - Workflow Task Mapping</strong>
                    <p className="mb-1">
                      Link accessorial charges to workflow steps. When a job has these accessorial charges,
                      the mapped steps are automatically injected into the driver's workflow.
                    </p>
                    <small className="text-muted">
                      Steps are injected by stage (Enroute to Pickup - Pickup - Enroute to Delivery - Delivery)
                      and ordered by sequence within each stage.
                    </small>
                  </div>

                  {/* Accessorial mapping table */}
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Accessorial Charge</th>
                          <th>Event Type (Step)</th>
                          <th>Stage</th>
                          <th>Sequence</th>
                          <th>Required</th>
                          <th>Config JSON</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessorialMappings.map((mapping, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                type="number"
                                value={mapping.accessorialChargeId || ''}
                                onChange={(e) => {
                                  const updated = [...accessorialMappings];
                                  updated[idx] = { ...updated[idx], accessorialChargeId: parseInt(e.target.value) || 0 };
                                  setAccessorialMappings(updated);
                                }}
                                placeholder="Charge ID"
                                style={{ width: 100 }}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                type="number"
                                value={mapping.eventTypeId || ''}
                                onChange={(e) => {
                                  const updated = [...accessorialMappings];
                                  updated[idx] = { ...updated[idx], eventTypeId: parseInt(e.target.value) || 0 };
                                  setAccessorialMappings(updated);
                                }}
                                placeholder="Event Type ID"
                                style={{ width: 100 }}
                              />
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={mapping.stageId}
                                onChange={(e) => {
                                  const updated = [...accessorialMappings];
                                  updated[idx] = { ...updated[idx], stageId: parseInt(e.target.value) };
                                  setAccessorialMappings(updated);
                                }}
                              >
                                {Object.entries(STAGE_ID_NAMES).map(([id, name]) => (
                                  <option key={id} value={id}>{name}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                type="number"
                                value={mapping.sequence}
                                onChange={(e) => {
                                  const updated = [...accessorialMappings];
                                  updated[idx] = { ...updated[idx], sequence: parseInt(e.target.value) || 0 };
                                  setAccessorialMappings(updated);
                                }}
                                style={{ width: 70 }}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={mapping.required}
                                onChange={(e) => {
                                  const updated = [...accessorialMappings];
                                  updated[idx] = { ...updated[idx], required: e.target.checked };
                                  setAccessorialMappings(updated);
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                value={mapping.configJson || ''}
                                onChange={(e) => {
                                  const updated = [...accessorialMappings];
                                  updated[idx] = { ...updated[idx], configJson: e.target.value || null };
                                  setAccessorialMappings(updated);
                                }}
                                placeholder='{"fields": [...]}'
                                style={{ width: 200 }}
                              />
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setAccessorialMappings(accessorialMappings.filter((_, i) => i !== idx))}
                              >
                                X
                              </button>
                            </td>
                          </tr>
                        ))}
                        {accessorialMappings.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center text-muted">
                              No accessorial mappings. Add one to link an accessorial charge to a workflow step.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setAccessorialMappings([
                      ...accessorialMappings,
                      { id: 0, accessorialChargeId: 0, accessorialChargeName: null, eventTypeId: 0, eventTypeName: null, stageId: 4, stageName: 'Delivery', sequence: accessorialMappings.length + 1, required: true, configJson: null, active: true },
                    ])}
                  >
                    + Add Accessorial Mapping
                  </button>
                </div>
              )}

              {activeSubTab === 'steps' && (<>
              {/* Stage preview pipeline */}
              <div className="mb-3">
                <label className="form-label">Stage Pipeline</label>
                <div className="d-flex gap-1">
                  {STAGES.map((stage) => {
                    const count = editorSteps.filter(
                      (s) => s.statusName === stage && s.isActive
                    ).length;
                    return (
                      <div
                        key={stage}
                        className={`flex-fill text-center p-2 rounded ${
                          count > 0 ? 'bg-primary text-white' : 'bg-light text-muted'
                        }`}
                      >
                        <small>{stage}</small>
                        <br />
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Steps table */}
              <div className="d-flex justify-content-between mb-2">
                <label className="form-label">Workflow Steps</label>
                <button className="btn btn-sm btn-outline-primary" onClick={addStep}>
                  + Add Step
                </button>
              </div>

              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Event Type</th>
                      <th>Stage Trigger</th>
                      <th>Time Offset</th>
                      <th>Active</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editorSteps.map((step, idx) => (
                      <tr key={idx}>
                        <td>{step.sequence}</td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={step.eventTypeId}
                            onChange={(e) => {
                              const id = parseInt(e.target.value);
                              const et = eventTypes.find((t) => t.id === id);
                              updateStep(idx, 'eventTypeId', id);
                              updateStep(idx, 'eventTypeName', et?.name || '');
                            }}
                          >
                            {eventTypes.map((et) => (
                              <option key={et.id} value={et.id}>
                                {et.name} ({et.id})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={step.statusId}
                            onChange={(e) => {
                              const id = parseInt(e.target.value);
                              const js = jobStatuses.find((s) => s.id === id);
                              updateStep(idx, 'statusId', id);
                              updateStep(idx, 'statusName', js?.name || '');
                            }}
                          >
                            {jobStatuses.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={step.timeOffset}
                            onChange={(e) =>
                              updateStep(idx, 'timeOffset', parseInt(e.target.value) || 0)
                            }
                            style={{ width: 80 }}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={step.isActive}
                            onChange={(e) =>
                              updateStep(idx, 'isActive', e.target.checked)
                            }
                          />
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-secondary"
                              onClick={() => moveStep(idx, -1)}
                              disabled={idx === 0}
                            >
                              Up
                            </button>
                            <button
                              className="btn btn-outline-secondary"
                              onClick={() => moveStep(idx, 1)}
                              disabled={idx === editorSteps.length - 1}
                            >
                              Dn
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => removeStep(idx)}
                            >
                              X
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {editorSteps.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted">
                          No steps yet. Add steps or use Auto-Mate.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              </>)}

              {/* Actions */}
              <div className="d-flex gap-2 mt-3">
                <button
                  className="btn btn-primary"
                  onClick={saveTemplate}
                  disabled={saving || !editorName.trim()}
                >
                  {saving ? 'Saving...' : selected ? 'Update Template' : 'Create Template'}
                </button>
                {selected && (
                  <button className="btn btn-outline-danger" onClick={deleteTemplate}>
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowsTab;
