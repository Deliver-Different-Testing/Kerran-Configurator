import { useState } from 'react';
import { ScopeSelector } from './ScopeSelector';
import { ConditionRow } from './ConditionRow';
import { ActionRow } from './ActionRow';
import type {
  AutomationRule,
  Condition,
  Action,
  ConditionType,
  ActionType,
  ConditionMatchMode,
  CustomerOption,
  SpeedOption,
  SiteOption,
  RegionOption,
  JobStatus,
  TaskTemplate,
  NotificationTemplate,
  ReportOption,
} from '../types';
import {
  CONDITION_TYPE_OPTIONS,
  ACTION_TYPE_OPTIONS,
  createEmptyCondition,
  createEmptyAction,
  getNaturalLanguageSummary,
} from '../types';

interface AutomationEditFormProps {
  automation: AutomationRule;
  customers: CustomerOption[];
  speeds: SpeedOption[];
  sites: SiteOption[];
  regions: RegionOption[];
  jobStatuses: JobStatus[];
  taskTemplates: TaskTemplate[];
  notificationTemplates: NotificationTemplate[];
  availableReports: ReportOption[];
  onSearchCustomers?: (query: string) => Promise<import('../types').CustomerOption[]>;
  onSave: (automation: AutomationRule) => void;
  onCancel: () => void;
  isNew?: boolean;
}

export function AutomationEditForm({
  automation,
  customers,
  speeds,
  sites,
  regions,
  jobStatuses,
  taskTemplates,
  notificationTemplates,
  availableReports,
  onSearchCustomers,
  onSave,
  onCancel,
  isNew = false,
}: AutomationEditFormProps) {
  const [formData, setFormData] = useState({
    name: automation.name,
    description: automation.description || '',
    scope: { ...automation.scope },
    conditionMatchMode: automation.conditionMatchMode,
    conditions: [...automation.conditions],
    actions: [...automation.actions],
    isActive: automation.isActive,
  });

  const [showConditionDropdown, setShowConditionDropdown] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateField = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors([]);
  };

  const addCondition = (type: ConditionType) => {
    updateField('conditions', [...formData.conditions, createEmptyCondition(type)]);
    setShowConditionDropdown(false);
  };

  const updateCondition = (index: number, condition: Condition) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = condition;
    updateField('conditions', newConditions);
  };

  const removeCondition = (index: number) => {
    updateField('conditions', formData.conditions.filter((_, i) => i !== index));
  };

  const addAction = (type: ActionType) => {
    updateField('actions', [...formData.actions, createEmptyAction(type)]);
    setShowActionDropdown(false);
  };

  const updateAction = (index: number, action: Action) => {
    const newActions = [...formData.actions];
    newActions[index] = action;
    updateField('actions', newActions);
  };

  const removeAction = (index: number) => {
    updateField('actions', formData.actions.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: string[] = [];
    if (!formData.name.trim()) newErrors.push('Automation name is required');
    if (formData.conditions.length === 0) newErrors.push('At least one condition is required');
    if (formData.actions.length === 0) newErrors.push('At least one action is required');
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const updatedAutomation: AutomationRule = {
      ...automation,
      name: formData.name,
      description: formData.description || undefined,
      scope: formData.scope,
      conditionMatchMode: formData.conditionMatchMode,
      conditions: formData.conditions,
      actions: formData.actions,
      isActive: formData.isActive,
      updatedAt: new Date().toISOString(),
    };
    if (isNew) updatedAutomation.createdAt = new Date().toISOString();
    onSave(updatedAutomation);
  };

  return (
    <div className="auto-edit-form">
      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="auto-error-banner">
          <strong>Please fix the following:</strong>
          <ul>
            {errors.map((error, i) => <li key={i}>{error}</li>)}
          </ul>
        </div>
      )}

      {/* Section 1: Basics */}
      <div className="auto-section">
        <h4 className="auto-section-title">Basics</h4>
        <div className="auto-field">
          <label>Automation Name <span className="auto-required">*</span></label>
          <input
            className="input"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Enter a descriptive name..."
          />
        </div>
        <div className="auto-field">
          <label>Description</label>
          <textarea
            className="input auto-textarea"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Explain what this automation does..."
            rows={2}
          />
        </div>
      </div>

      {/* Section 2: Scope & Filters */}
      <div className="auto-section auto-section-bordered">
        <div>
          <h4 className="auto-section-title">Scope & Filters</h4>
          <div className="auto-section-subtitle">Define which jobs this automation applies to</div>
        </div>
        <ScopeSelector
          scope={formData.scope}
          customers={customers}
          speeds={speeds}
          sites={sites}
          regions={regions}
          jobStatuses={jobStatuses}
          onChange={(scope) => updateField('scope', scope)}
          onSearchCustomers={onSearchCustomers}
        />
      </div>

      {/* Section 3: Conditions */}
      <div className="auto-section auto-section-bordered">
        <div className="auto-section-header">
          <div>
            <h4 className="auto-section-title">Trigger Conditions (IF)</h4>
            <div className="auto-section-subtitle">Define when this automation should fire</div>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowConditionDropdown(!showConditionDropdown)}>
              + Add Condition
            </button>
            {showConditionDropdown && (
              <div className="auto-dropdown">
                {CONDITION_TYPE_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => addCondition(opt.value)} className="auto-dropdown-item">
                    <span>{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Condition List with inline AND/OR pills */}
        {formData.conditions.length > 0 ? (
          <div className="auto-rows">
            {formData.conditions.map((condition, index) => (
              <div key={condition.id}>
                <ConditionRow
                  condition={condition}
                  jobStatuses={jobStatuses}
                  onChange={(c) => updateCondition(index, c)}
                  onRemove={() => removeCondition(index)}
                />
                {/* Inline AND/OR pill between conditions */}
                {index < formData.conditions.length - 1 && (
                  <div className="auto-andor-row">
                    <div className="auto-andor-pill">
                      <button
                        type="button"
                        onClick={() => updateField('conditionMatchMode', 'all')}
                        className={`auto-andor-btn${formData.conditionMatchMode === 'all' ? ' active' : ''}`}
                      >
                        AND
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('conditionMatchMode', 'any')}
                        className={`auto-andor-btn${formData.conditionMatchMode === 'any' ? ' active' : ''}`}
                      >
                        OR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="auto-empty-state">
            <p>No conditions yet.</p>
            <p>Click "Add Condition" to define when this automation triggers.</p>
          </div>
        )}
      </div>

      {/* Section 4: Actions */}
      <div className="auto-section auto-section-bordered">
        <div className="auto-section-header">
          <div>
            <h4 className="auto-section-title">Actions (THEN)</h4>
            <div className="auto-section-subtitle">Define what happens when conditions are met</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowActionDropdown(!showActionDropdown)}>
              + Add Action
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(59,199,244,.1)', color: 'var(--cyan)', border: '1px solid rgba(59,199,244,.3)' }}
              onClick={() => addAction('wait_for_condition' as ActionType)}
              title="Insert a wait step — pauses the workflow until a condition is met"
            >
              + Wait Condition
            </button>
            {showActionDropdown && (
              <div className="auto-dropdown">
                {ACTION_TYPE_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => addAction(opt.value)} className="auto-dropdown-item">
                    <span>{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {formData.actions.length > 0 ? (
          <div className="auto-rows">
            {formData.actions.map((action, index) => (
              <ActionRow
                key={action.id}
                action={action}
                jobStatuses={jobStatuses}
                taskTemplates={taskTemplates}
                notificationTemplates={notificationTemplates}
                availableReports={availableReports}
                onChange={(a) => updateAction(index, a)}
                onRemove={() => removeAction(index)}
              />
            ))}
          </div>
        ) : (
          <div className="auto-empty-state">
            <p>No actions yet.</p>
            <p>Click "Add Action" to define what happens when triggered.</p>
          </div>
        )}
      </div>

      {/* Section 5: Plain English Summary */}
      {(formData.conditions.length > 0 || formData.actions.length > 0) && (
        <div className="auto-summary-box">
          <div className="auto-summary-header">Plain English</div>
          <p className="auto-summary-text">
            {getNaturalLanguageSummary(
              { conditions: formData.conditions, conditionMatchMode: formData.conditionMatchMode, actions: formData.actions, scope: formData.scope },
              { jobStatuses, taskTemplates, notificationTemplates, customers, speeds }
            )}
          </p>
        </div>
      )}

      {/* Section 6: Status & Save */}
      <div className="auto-section auto-section-bordered auto-footer">
        <div className="auto-footer-left">
          <label className="toggle">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => updateField('isActive', e.target.checked)}
            />
            <span className="slider"></span>
          </label>
          <span className="auto-label-text">{formData.isActive ? 'Active' : 'Inactive'}</span>
          <span className="auto-label-xs" style={{ marginLeft: 12 }}>
            {formData.conditions.length} condition{formData.conditions.length !== 1 ? 's' : ''},{' '}
            {formData.actions.length} action{formData.actions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="auto-footer-right">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            {isNew ? 'Create Automation' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
