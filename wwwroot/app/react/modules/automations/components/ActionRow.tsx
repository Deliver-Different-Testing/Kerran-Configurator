import { useRef } from 'react';
import type {
  Action,
  ActionType,
  SmsRecipientType,
  EmailRecipientType,
  JobStatus,
  TaskTemplate,
  NotificationTemplate,
  ReportOption,
} from '../types';
import type {
  ConditionType,
  StatusConditionMode,
  ScheduledTimeField,
  TimeUnit,
  ScanType,
} from '../types';
import {
  ACTION_TYPE_OPTIONS,
  SMS_RECIPIENT_OPTIONS,
  EMAIL_RECIPIENT_OPTIONS,
  WAIT_CONDITION_OPTION,
  CONDITION_TYPE_OPTIONS,
  STATUS_CONDITION_MODES,
  SCHEDULED_TIME_OPTIONS,
  TIME_UNIT_OPTIONS,
  SCAN_TYPE_OPTIONS,
  createEmptyAction,
} from '../types';
import { RichTextEditor, type RichTextEditorRef } from './RichTextEditor';
import { MergeFieldPicker } from './MergeFieldPicker';

interface ActionRowProps {
  action: Action;
  jobStatuses: JobStatus[];
  taskTemplates: TaskTemplate[];
  notificationTemplates: NotificationTemplate[];
  availableReports: ReportOption[];
  onChange: (action: Action) => void;
  onRemove: () => void;
}

export function ActionRow({
  action,
  jobStatuses,
  taskTemplates,
  notificationTemplates,
  availableReports,
  onChange,
  onRemove,
}: ActionRowProps) {
  const editorRef = useRef<RichTextEditorRef>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
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

      case 'wait_for_condition':
        return (
          <div className="auto-row-stacked auto-wait-condition">
            <div className="auto-row-fields">
              <label className="auto-label-text">Wait until:</label>
              <select
                value={action.waitConditionType}
                onChange={(e) => onChange({ ...action, waitConditionType: e.target.value as ConditionType })}
                className="auto-select-sm"
              >
                {CONDITION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                ))}
              </select>
            </div>

            {/* Status-specific fields */}
            {action.waitConditionType === 'status' && (
              <>
                <div className="auto-row-fields">
                  <label className="auto-label-text">Mode:</label>
                  <select
                    value={action.waitStatusMode || 'any_change'}
                    onChange={(e) => onChange({ ...action, waitStatusMode: e.target.value as StatusConditionMode })}
                    className="auto-select-sm"
                  >
                    {STATUS_CONDITION_MODES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {action.waitStatusMode && action.waitStatusMode !== 'any_change' && (
                  <div className="auto-row-fields">
                    <label className="auto-label-text">Status:</label>
                    <select
                      value={action.waitStatusId || ''}
                      onChange={(e) => onChange({ ...action, waitStatusId: e.target.value || undefined })}
                      className="auto-select-sm"
                    >
                      <option value="">Select status...</option>
                      {jobStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Time-based fields */}
            {(action.waitConditionType === 'before_scheduled_time' ||
              action.waitConditionType === 'after_scheduled_time' ||
              action.waitConditionType === 'at_scheduled_time') && (
              <div className="auto-row-fields">
                <label className="auto-label-text">Time field:</label>
                <select
                  value={action.waitScheduledTimeField || 'pickup'}
                  onChange={(e) => onChange({ ...action, waitScheduledTimeField: e.target.value as ScheduledTimeField })}
                  className="auto-select-sm"
                >
                  {SCHEDULED_TIME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {action.waitConditionType !== 'at_scheduled_time' && (
                  <>
                    <input
                      type="number"
                      value={action.waitOffsetValue ?? ''}
                      onChange={(e) => onChange({ ...action, waitOffsetValue: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      placeholder="30"
                      className="input auto-input-sm auto-input-num"
                    />
                    <select
                      value={action.waitOffsetUnit || 'minutes'}
                      onChange={(e) => onChange({ ...action, waitOffsetUnit: e.target.value as TimeUnit })}
                      className="auto-select-sm"
                    >
                      {TIME_UNIT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}

            {/* Scan type fields */}
            {action.waitConditionType === 'scan' && (
              <div className="auto-row-fields" style={{ flexWrap: 'wrap' }}>
                <label className="auto-label-text" style={{ width: '100%' }}>Scan types:</label>
                {SCAN_TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="auto-checkbox-label auto-checkbox-sm">
                    <input
                      type="checkbox"
                      checked={action.waitScanTypes?.includes(opt.value) ?? false}
                      onChange={(e) => {
                        const current = action.waitScanTypes || [];
                        const newTypes = e.target.checked
                          ? [...current, opt.value]
                          : current.filter((t) => t !== opt.value);
                        onChange({ ...action, waitScanTypes: newTypes as ScanType[] });
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}

            <div className="auto-label-xs" style={{ color: 'rgba(59,199,244,.8)', fontWeight: 500 }}>
              Execution pauses here until this condition is met, then continues to the next action.
            </div>
          </div>
        );

      case 'send_email':
        return (
          <div className="auto-row-stacked">
            {/* Email Recipient */}
            <div className="auto-row-fields">
              <label className="auto-label-text">Send to:</label>
              <select
                value={action.emailRecipient}
                onChange={(e) =>
                  onChange({
                    ...action,
                    emailRecipient: e.target.value as EmailRecipientType,
                    customEmailAddresses: e.target.value === 'custom' ? action.customEmailAddresses : undefined,
                  })
                }
                className="auto-select-sm"
              >
                {EMAIL_RECIPIENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Custom email addresses */}
            {action.emailRecipient === 'custom' && (
              <div className="auto-row-fields">
                <label className="auto-label-text">Email address(es):</label>
                <input
                  type="text"
                  value={action.customEmailAddresses || ''}
                  onChange={(e) => onChange({ ...action, customEmailAddresses: e.target.value })}
                  placeholder="user@example.com; user2@example.com"
                  className="input auto-input-sm"
                  style={{ flex: 1 }}
                />
                <span className="auto-label-xs">Separate multiple addresses with semicolons</span>
              </div>
            )}

            {/* Reply-To */}
            <div className="auto-row-fields">
              <label className="auto-label-text">Reply-to email:</label>
              <input
                type="email"
                value={action.replyToEmail || ''}
                onChange={(e) => onChange({ ...action, replyToEmail: e.target.value || undefined })}
                placeholder="reply@example.com (optional)"
                className="input auto-input-sm"
                style={{ width: 300 }}
              />
            </div>

            {/* Subject */}
            <div className="auto-row-fields">
              <label className="auto-label-text">Subject:</label>
              <input
                ref={subjectRef}
                type="text"
                value={action.emailSubject}
                onChange={(e) => onChange({ ...action, emailSubject: e.target.value })}
                placeholder="Email subject line... Use {JobNumber}, {ClientName} for variables"
                className="input auto-input-sm"
                style={{ flex: 1 }}
              />
            </div>

            {/* Email Body — Rich Text Editor */}
            <div>
              <label className="auto-label-text" style={{ display: 'block', marginBottom: 4 }}>Email Template:</label>
              <RichTextEditor
                ref={editorRef}
                value={action.emailTemplate}
                onChange={(val) => onChange({ ...action, emailTemplate: val })}
                placeholder="Compose your email... Use merge fields to personalise."
              />
            </div>

            {/* Merge Field Picker */}
            <MergeFieldPicker
              onInsert={(fieldName) => {
                const placeholder = `{${fieldName}}`;
                // Insert into TinyMCE editor if it has focus, otherwise append to subject
                if (editorRef.current) {
                  editorRef.current.insertContent(placeholder);
                }
              }}
            />

            {/* Report Attachment */}
            {availableReports.length > 0 && (
              <div className="auto-row-fields">
                <label className="auto-label-text">Attach report:</label>
                <select
                  value={action.attachReportKey || ''}
                  onChange={(e) => onChange({ ...action, attachReportKey: e.target.value || undefined })}
                  className="auto-select-sm"
                >
                  <option value="">No attachment</option>
                  {availableReports.map((r) => (
                    <option key={r.key} value={r.key}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
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
          className={`auto-select-sm auto-select-bold${action.type === 'wait_for_condition' ? ' auto-select-wait' : ''}`}
        >
          {ACTION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
          ))}
          <option value={WAIT_CONDITION_OPTION.value}>{WAIT_CONDITION_OPTION.icon} {WAIT_CONDITION_OPTION.label}</option>
        </select>
      </div>
      <div className="auto-row-body">{renderTypeFields()}</div>
      <button type="button" onClick={onRemove} className="auto-row-remove" title="Remove">
        ✕
      </button>
    </div>
  );
}
