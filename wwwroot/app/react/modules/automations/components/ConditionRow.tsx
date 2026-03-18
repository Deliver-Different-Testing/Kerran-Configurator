import type {
  Condition,
  ConditionType,
  JobTypeFilter,
  ScheduledTimeField,
  TimeUnit,
  StatusConditionMode,
  ScanType,
  JobStatus,
} from '../types';
import {
  CONDITION_TYPE_OPTIONS,
  JOB_TYPE_OPTIONS,
  SCHEDULED_TIME_OPTIONS,
  TIME_UNIT_OPTIONS,
  STATUS_CONDITION_MODES,
  SCAN_TYPE_OPTIONS,
  createEmptyCondition,
} from '../types';

interface ConditionRowProps {
  condition: Condition;
  jobStatuses: JobStatus[];
  onChange: (condition: Condition) => void;
  onRemove: () => void;
}

export function ConditionRow({ condition, jobStatuses, onChange, onRemove }: ConditionRowProps) {
  const handleTypeChange = (type: ConditionType) => {
    const newCondition = createEmptyCondition(type);
    newCondition.id = condition.id;
    newCondition.jobTypeFilter = condition.jobTypeFilter;
    onChange(newCondition);
  };

  const handleJobTypeChange = (jobTypeFilter: JobTypeFilter) => {
    onChange({ ...condition, jobTypeFilter });
  };

  const renderTypeFields = () => {
    switch (condition.type) {
      case 'job_unassigned':
      case 'job_assigned':
        return null;

      case 'before_scheduled_time':
      case 'after_scheduled_time':
        return (
          <div className="auto-row-fields">
            <input
              type="number"
              value={condition.offsetValue}
              onChange={(e) => onChange({ ...condition, offsetValue: parseInt(e.target.value, 10) || 0 })}
              className="input auto-input-sm auto-input-num"
              min={0}
            />
            <select
              value={condition.offsetUnit}
              onChange={(e) => onChange({ ...condition, offsetUnit: e.target.value as TimeUnit })}
              className="auto-select-sm"
            >
              {TIME_UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="auto-label-text">
              {condition.type === 'before_scheduled_time' ? 'before' : 'after'}
            </span>
            <select
              value={condition.scheduledTimeField}
              onChange={(e) => onChange({ ...condition, scheduledTimeField: e.target.value as ScheduledTimeField })}
              className="auto-select-sm"
            >
              {SCHEDULED_TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'at_scheduled_time':
        return (
          <div className="auto-row-fields">
            <span className="auto-label-text">At</span>
            <select
              value={condition.scheduledTimeField}
              onChange={(e) => onChange({ ...condition, scheduledTimeField: e.target.value as ScheduledTimeField })}
              className="auto-select-sm"
            >
              {SCHEDULED_TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'status':
        return (
          <div className="auto-row-fields">
            <select
              value={condition.mode}
              onChange={(e) => onChange({
                ...condition,
                mode: e.target.value as StatusConditionMode,
                statusId: e.target.value === 'any_change' ? undefined : condition.statusId,
              })}
              className="auto-select-sm"
            >
              {STATUS_CONDITION_MODES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {condition.mode !== 'any_change' && (
              <select
                value={condition.statusId || ''}
                onChange={(e) => onChange({ ...condition, statusId: e.target.value })}
                className="auto-select-sm"
              >
                <option value="">Select status...</option>
                {jobStatuses.map((status) => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>
            )}
          </div>
        );

      case 'scan':
        return (
          <div className="auto-chip-list">
            {SCAN_TYPE_OPTIONS.map((opt) => {
              const isSelected = condition.scanTypes.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const newTypes = isSelected
                      ? condition.scanTypes.filter((t) => t !== opt.value)
                      : [...condition.scanTypes, opt.value];
                    onChange({ ...condition, scanTypes: newTypes as ScanType[] });
                  }}
                  className={`auto-chip auto-chip-sm${isSelected ? ' selected' : ''}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="auto-row-card">
      <div className="auto-row-type">
        <select
          value={condition.type}
          onChange={(e) => handleTypeChange(e.target.value as ConditionType)}
          className="auto-select-sm auto-select-bold"
        >
          {CONDITION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
          ))}
        </select>
      </div>

      <div className="auto-row-body">
        <div className="auto-row-fields">
          <label className="auto-label-xs">Job type:</label>
          <select
            value={condition.jobTypeFilter}
            onChange={(e) => handleJobTypeChange(e.target.value as JobTypeFilter)}
            className="auto-select-xs"
          >
            {JOB_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {renderTypeFields()}
      </div>

      <button type="button" onClick={onRemove} className="auto-row-remove" title="Remove">
        ✕
      </button>
    </div>
  );
}
