import type {
  Action,
  ActionType,
  SmsRecipientType,
  JobStatus,
  TaskTemplate,
  NotificationTemplate,
} from '../types';
import { ACTION_TYPE_OPTIONS, SMS_RECIPIENT_OPTIONS, createEmptyAction } from '../types';

interface ActionRowProps {
  action: Action;
  jobStatuses: JobStatus[];
  taskTemplates: TaskTemplate[];
  notificationTemplates: NotificationTemplate[];
  onChange: (action: Action) => void;
  onRemove: () => void;
}

export function ActionRow({
  action,
  jobStatuses,
  taskTemplates,
  notificationTemplates,
  onChange,
  onRemove,
}: ActionRowProps) {
  const handleTypeChange = (type: ActionType) => {
    const newAction = createEmptyAction(type);
    newAction.id = action.id;
    onChange(newAction);
  };

  const renderTypeFields = () => {
    switch (action.type) {
      case 'update_job_status':
        return (
          <div className="auto-row-stacked">
            <div className="auto-row-fields">
              <label className="auto-label-text">Set status to:</label>
              <select
                value={action.statusId}
                onChange={(e) => onChange({ ...action, statusId: e.target.value })}
                className="auto-select-sm"
              >
                <option value="">Select status...</option>
                {jobStatuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="auto-row-fields">
              <label className="auto-label-text" style={{ color: 'rgba(13,12,44,.4)' }}>Only if currently:</label>
              <select
                value={action.fromStatusId || ''}
                onChange={(e) =>
                  onChange({ ...action, fromStatusId: e.target.value || undefined })
                }
                className="auto-select-sm"
              >
                <option value="">(any status — no guard)</option>
                {jobStatuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span className="auto-label-xs">Optional — restricts when the status change applies</span>
            </div>
          </div>
        );

      case 'create_task':
        return (
          <div className="auto-row-stacked">
            <div className="auto-row-fields">
              <label className="auto-label-text">Task template:</label>
              <select
                value={action.taskTemplateId}
                onChange={(e) => onChange({ ...action, taskTemplateId: e.target.value })}
                className="auto-select-sm"
              >
                <option value="">Select task template...</option>
                {taskTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="auto-row-fields">
              <label className="auto-label-text">Due time offset:</label>
              <input
                type="number"
                value={action.dueTimeOffsetMinutes ?? ''}
                onChange={(e) =>
                  onChange({ ...action, dueTimeOffsetMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined })
                }
                placeholder="minutes"
                className="input auto-input-sm auto-input-num"
              />
              <span className="auto-label-xs">minutes (optional)</span>
            </div>
          </div>
        );

      case 'complete_task':
        return (
          <div className="auto-row-fields">
            <label className="auto-label-text">Task to complete:</label>
            <select
              value={action.taskTemplateId}
              onChange={(e) => onChange({ ...action, taskTemplateId: e.target.value })}
              className="auto-select-sm"
            >
              <option value="">Select task template...</option>
              {taskTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        );

      case 'trigger_notification':
        return (
          <div className="auto-row-fields">
            <label className="auto-label-text">Notification:</label>
            <select
              value={action.notificationTemplateId}
              onChange={(e) => onChange({ ...action, notificationTemplateId: e.target.value })}
              className="auto-select-sm"
            >
              <option value="">Select notification...</option>
              {notificationTemplates.map((n) => (
                <option key={n.id} value={n.id}>{n.name} ({n.type})</option>
              ))}
            </select>
          </div>
        );

      case 'send_sms':
        return (
          <div className="auto-row-stacked">
            <div className="auto-row-fields">
              <label className="auto-label-text">Send to:</label>
              <select
                value={action.recipientType}
                onChange={(e) =>
                  onChange({
                    ...action,
                    recipientType: e.target.value as SmsRecipientType,
                    fixedPhoneNumber: e.target.value === 'fixed_number' ? action.fixedPhoneNumber : undefined,
                  })
                }
                className="auto-select-sm"
              >
                {SMS_RECIPIENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {action.recipientType === 'fixed_number' && (
              <div className="auto-row-fields">
                <label className="auto-label-text">Phone number:</label>
                <input
                  type="tel"
                  value={action.fixedPhoneNumber || ''}
                  onChange={(e) => onChange({ ...action, fixedPhoneNumber: e.target.value })}
                  placeholder="+1 555 123 4567"
                  className="input auto-input-sm"
                  style={{ width: 180 }}
                />
              </div>
            )}
            <div>
              <label className="auto-label-text" style={{ display: 'block', marginBottom: 4 }}>Message:</label>
              <textarea
                value={action.messageContent}
                onChange={(e) => onChange({ ...action, messageContent: e.target.value })}
                placeholder="Enter message content... Use {JobNumber}, {ClientName} for variables."
                rows={2}
                className="input auto-textarea"
              />
            </div>
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
          value={action.type}
          onChange={(e) => handleTypeChange(e.target.value as ActionType)}
          className="auto-select-sm auto-select-bold"
        >
          {ACTION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
          ))}
        </select>
      </div>
      <div className="auto-row-body">{renderTypeFields()}</div>
      <button type="button" onClick={onRemove} className="auto-row-remove" title="Remove">
        ✕
      </button>
    </div>
  );
}
