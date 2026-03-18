// Automations Module Types
// Configuration-only: defines "if this then that" automation rules

// ============================================
// SCOPE TYPES
// ============================================

export interface CustomerOption {
  id: string;
  name: string;
  shortName: string;
}

export interface SpeedOption {
  id: string;
  name: string;
  code: string;
}

export interface SiteOption {
  id: string;
  name: string;
}

export interface RegionOption {
  id: string;
  name: string;
}

export interface AutomationScope {
  allCustomers: boolean;
  customerIds: string[];
  allSpeeds: boolean;
  speedIds: string[];
  // Advanced scope filters — all use "apply to all" + multi-select pattern
  allJobStatuses: boolean;
  jobStatusIds: string[];
  allPriorities: boolean;
  priorityIds: string[];
  allFromSites: boolean;
  fromSiteIds: string[];
  allToSites: boolean;
  toSiteIds: string[];
  allFromRegions: boolean;
  fromRegionIds: string[];
  allToRegions: boolean;
  toRegionIds: string[];
  timeThreshold?: number;
}

// ============================================
// CONDITION TYPES
// ============================================

export type JobTypeFilter =
  | 'all'
  | 'child_1_pickup'
  | 'child_2_flight'
  | 'child_3_delivery'
  | 'standard';

export const JOB_TYPE_OPTIONS: { value: JobTypeFilter; label: string }[] = [
  { value: 'all', label: 'All job types' },
  { value: 'child_1_pickup', label: 'Child 1 (Pickup / Collection)' },
  { value: 'child_2_flight', label: 'Child 2 (Flight / Transport)' },
  { value: 'child_3_delivery', label: 'Child 3 (Delivery)' },
  { value: 'standard', label: 'Standard job (non parent/child)' },
];

export type ScheduledTimeField = 'pickup' | 'delivery' | 'flight';

export const SCHEDULED_TIME_OPTIONS: { value: ScheduledTimeField; label: string }[] = [
  { value: 'pickup', label: 'Pickup time' },
  { value: 'delivery', label: 'Delivery time' },
  { value: 'flight', label: 'Flight time' },
];

export type TimeUnit = 'minutes' | 'hours';

export const TIME_UNIT_OPTIONS: { value: TimeUnit; label: string }[] = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
];

export type StatusConditionMode =
  | 'any_change'
  | 'changes_to'
  | 'leaves'
  | 'is_not';

export const STATUS_CONDITION_MODES: { value: StatusConditionMode; label: string }[] = [
  { value: 'any_change', label: 'When status changes (any change)' },
  { value: 'changes_to', label: 'When status changes to a specific status' },
  { value: 'leaves', label: 'When status leaves a specific status' },
  { value: 'is_not', label: 'When status is not a specific status' },
];

export type ScanType =
  | 'sort_scan'
  | 'alternative_sort_scan'
  | 'run_scan'
  | 'invalid_run_scan'
  | 'transit_scan'
  | 'inwards_depot_scan'
  | 'pickup_scan'
  | 'invalid_pickup_scan'
  | 'transfer_scan';

export const SCAN_TYPE_OPTIONS: { value: ScanType; label: string }[] = [
  { value: 'sort_scan', label: 'Sort scan' },
  { value: 'alternative_sort_scan', label: 'Alternative sort scan' },
  { value: 'run_scan', label: 'Run scan' },
  { value: 'invalid_run_scan', label: 'Invalid run scan' },
  { value: 'transit_scan', label: 'Transit scan' },
  { value: 'inwards_depot_scan', label: 'Inwards depot scan' },
  { value: 'pickup_scan', label: 'Pickup scan' },
  { value: 'invalid_pickup_scan', label: 'Invalid pickup scan' },
  { value: 'transfer_scan', label: 'Transfer scan' },
];

export type ConditionType =
  | 'job_unassigned'
  | 'job_assigned'
  | 'before_scheduled_time'
  | 'after_scheduled_time'
  | 'at_scheduled_time'
  | 'status'
  | 'scan';

export const CONDITION_TYPE_OPTIONS: { value: ConditionType; label: string; icon: string }[] = [
  { value: 'job_unassigned', label: 'Job unassigned', icon: '👤' },
  { value: 'job_assigned', label: 'Job assigned', icon: '✓' },
  { value: 'before_scheduled_time', label: 'Before scheduled time', icon: '⏰' },
  { value: 'after_scheduled_time', label: 'After scheduled time', icon: '⏱️' },
  { value: 'at_scheduled_time', label: 'At scheduled time', icon: '🕐' },
  { value: 'status', label: 'Status condition / change', icon: '📊' },
  { value: 'scan', label: 'Scan event', icon: '📷' },
];

interface BaseCondition {
  id: string;
  type: ConditionType;
  jobTypeFilter: JobTypeFilter;
}

export interface JobUnassignedCondition extends BaseCondition {
  type: 'job_unassigned';
}

export interface JobAssignedCondition extends BaseCondition {
  type: 'job_assigned';
}

export interface BeforeScheduledTimeCondition extends BaseCondition {
  type: 'before_scheduled_time';
  scheduledTimeField: ScheduledTimeField;
  offsetValue: number;
  offsetUnit: TimeUnit;
}

export interface AfterScheduledTimeCondition extends BaseCondition {
  type: 'after_scheduled_time';
  scheduledTimeField: ScheduledTimeField;
  offsetValue: number;
  offsetUnit: TimeUnit;
}

export interface AtScheduledTimeCondition extends BaseCondition {
  type: 'at_scheduled_time';
  scheduledTimeField: ScheduledTimeField;
}

export interface StatusCondition extends BaseCondition {
  type: 'status';
  mode: StatusConditionMode;
  statusId?: string;
}

export interface ScanCondition extends BaseCondition {
  type: 'scan';
  scanTypes: ScanType[];
}

export type Condition =
  | JobUnassignedCondition
  | JobAssignedCondition
  | BeforeScheduledTimeCondition
  | AfterScheduledTimeCondition
  | AtScheduledTimeCondition
  | StatusCondition
  | ScanCondition;

export type ConditionMatchMode = 'all' | 'any';

export const CONDITION_MATCH_MODE_OPTIONS: { value: ConditionMatchMode; label: string }[] = [
  { value: 'all', label: 'All conditions must be true (AND)' },
  { value: 'any', label: 'Any condition can be true (OR)' },
];

// ============================================
// ACTION TYPES
// ============================================

export type ActionType =
  | 'update_job_status'
  | 'create_task'
  | 'complete_task'
  | 'trigger_notification'
  | 'send_sms';

export const ACTION_TYPE_OPTIONS: { value: ActionType; label: string; icon: string }[] = [
  { value: 'update_job_status', label: 'Update job status', icon: '📊' },
  { value: 'create_task', label: 'Create task', icon: '📋' },
  { value: 'complete_task', label: 'Complete task', icon: '✅' },
  { value: 'trigger_notification', label: 'Trigger notification', icon: '🔔' },
  { value: 'send_sms', label: 'Send text message (SMS)', icon: '💬' },
];

export type SmsRecipientType = 'customer_contact' | 'driver' | 'fixed_number';

export const SMS_RECIPIENT_OPTIONS: { value: SmsRecipientType; label: string }[] = [
  { value: 'customer_contact', label: 'Customer contact' },
  { value: 'driver', label: 'Driver' },
  { value: 'fixed_number', label: 'Fixed phone number' },
];

interface BaseAction {
  id: string;
  type: ActionType;
}

/**
 * Update job status action.
 * Optional fromStatusId acts as a guard — only changes status if job is currently in that status.
 */
export interface UpdateJobStatusAction extends BaseAction {
  type: 'update_job_status';
  fromStatusId?: string;
  statusId: string;
}

export interface CreateTaskAction extends BaseAction {
  type: 'create_task';
  taskTemplateId: string;
  assigneeId?: string;
  assigneeGroupId?: string;
  dueTimeOffsetMinutes?: number;
}

export interface CompleteTaskAction extends BaseAction {
  type: 'complete_task';
  taskTemplateId: string;
}

export interface TriggerNotificationAction extends BaseAction {
  type: 'trigger_notification';
  notificationTemplateId: string;
  targetType?: string;
}

export interface SendSmsAction extends BaseAction {
  type: 'send_sms';
  recipientType: SmsRecipientType;
  fixedPhoneNumber?: string;
  messageContent: string;
  useTemplate?: boolean;
  templateId?: string;
}

export type Action =
  | UpdateJobStatusAction
  | CreateTaskAction
  | CompleteTaskAction
  | TriggerNotificationAction
  | SendSmsAction;

// ============================================
// AUTOMATION RULE
// ============================================

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  scope: AutomationScope;
  conditionMatchMode: ConditionMatchMode;
  conditions: Condition[];
  actions: Action[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

// ============================================
// FILTER STATE
// ============================================

export interface AutomationFilterState {
  customerId: string | 'all';
  speedId: string | 'all';
  search: string;
}

// ============================================
// REFERENCE DATA TYPES
// ============================================

export interface JobStatus {
  id: string;
  name: string;
  code: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'single' | 'group';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getAutomationIcons(rule: AutomationRule): string {
  const icons: string[] = [];
  for (const action of rule.actions) {
    switch (action.type) {
      case 'update_job_status':
        if (!icons.includes('📊')) icons.push('📊');
        break;
      case 'create_task':
      case 'complete_task':
        if (!icons.includes('📋')) icons.push('📋');
        break;
      case 'trigger_notification':
        if (!icons.includes('🔔')) icons.push('🔔');
        break;
      case 'send_sms':
        if (!icons.includes('💬')) icons.push('💬');
        break;
    }
  }
  return icons.join(' ');
}

export function getTriggerSummary(rule: AutomationRule): string {
  if (rule.conditions.length === 0) return 'No triggers';
  if (rule.conditions.length === 1) return getConditionSummary(rule.conditions[0]);
  const mode = rule.conditionMatchMode === 'all' ? 'all of' : 'any of';
  return `${mode} ${rule.conditions.length} conditions`;
}

export function getActionSummary(rule: AutomationRule): string {
  if (rule.actions.length === 0) return 'No actions';
  if (rule.actions.length === 1) return getActionLabel(rule.actions[0]);
  return `${rule.actions.length} actions`;
}

export function getConditionSummary(condition: Condition): string {
  switch (condition.type) {
    case 'job_unassigned': return 'Job is unassigned';
    case 'job_assigned': return 'Job is assigned';
    case 'before_scheduled_time':
      return `${condition.offsetValue} ${condition.offsetUnit} before ${condition.scheduledTimeField}`;
    case 'after_scheduled_time':
      return `${condition.offsetValue} ${condition.offsetUnit} after ${condition.scheduledTimeField}`;
    case 'at_scheduled_time':
      return `At ${condition.scheduledTimeField} time`;
    case 'status':
      return STATUS_CONDITION_MODES.find(m => m.value === condition.mode)?.label ?? 'Status change';
    case 'scan':
      return `Scan event (${condition.scanTypes.length} types)`;
    default: return 'Unknown condition';
  }
}

export function getActionLabel(action: Action): string {
  return ACTION_TYPE_OPTIONS.find(a => a.value === action.type)?.label ?? 'Unknown action';
}

export function getScopeSummary(
  scope: AutomationScope,
  customers: CustomerOption[],
  speeds: SpeedOption[]
): { customerText: string; speedText: string } {
  let customerText = 'All customers';
  let speedText = 'All speeds';

  if (!scope.allCustomers && scope.customerIds.length > 0) {
    const names = scope.customerIds
      .map(id => customers.find(c => c.id === id)?.shortName ?? id)
      .slice(0, 3);
    customerText = scope.customerIds.length > 3
      ? `${names.join(', ')} +${scope.customerIds.length - 3} more`
      : names.join(', ');
  }

  if (!scope.allSpeeds && scope.speedIds.length > 0) {
    const names = scope.speedIds
      .map(id => speeds.find(s => s.id === id)?.name ?? id)
      .slice(0, 3);
    speedText = scope.speedIds.length > 3
      ? `${names.join(', ')} +${scope.speedIds.length - 3} more`
      : names.join(', ');
  }

  return { customerText, speedText };
}

export function createEmptyCondition(type: ConditionType): Condition {
  const base = { id: `cond-${Date.now()}`, jobTypeFilter: 'all' as JobTypeFilter };
  switch (type) {
    case 'job_unassigned': return { ...base, type: 'job_unassigned' };
    case 'job_assigned': return { ...base, type: 'job_assigned' };
    case 'before_scheduled_time':
      return { ...base, type: 'before_scheduled_time', scheduledTimeField: 'pickup', offsetValue: 30, offsetUnit: 'minutes' };
    case 'after_scheduled_time':
      return { ...base, type: 'after_scheduled_time', scheduledTimeField: 'pickup', offsetValue: 15, offsetUnit: 'minutes' };
    case 'at_scheduled_time':
      return { ...base, type: 'at_scheduled_time', scheduledTimeField: 'pickup' };
    case 'status': return { ...base, type: 'status', mode: 'any_change' };
    case 'scan': return { ...base, type: 'scan', scanTypes: [] };
    default: return { ...base, type: 'job_unassigned' };
  }
}

export function createEmptyAction(type: ActionType): Action {
  const base = { id: `action-${Date.now()}` };
  switch (type) {
    case 'update_job_status': return { ...base, type: 'update_job_status', statusId: '' };
    case 'create_task': return { ...base, type: 'create_task', taskTemplateId: '' };
    case 'complete_task': return { ...base, type: 'complete_task', taskTemplateId: '' };
    case 'trigger_notification': return { ...base, type: 'trigger_notification', notificationTemplateId: '' };
    case 'send_sms': return { ...base, type: 'send_sms', recipientType: 'customer_contact', messageContent: '' };
    default: return { ...base, type: 'update_job_status', statusId: '' };
  }
}

export function createEmptyAutomation(): Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    description: '',
    scope: {
      allCustomers: true,
      customerIds: [],
      allSpeeds: true,
      speedIds: [],
      allJobStatuses: false,
      jobStatusIds: [],
      allPriorities: false,
      priorityIds: [],
      allFromSites: false,
      fromSiteIds: [],
      allToSites: false,
      toSiteIds: [],
      allFromRegions: false,
      fromRegionIds: [],
      allToRegions: false,
      toRegionIds: [],
    },
    conditionMatchMode: 'all',
    conditions: [],
    actions: [],
    isActive: true,
  };
}

/**
 * Generate a natural language summary of what an automation rule does.
 */
export function getNaturalLanguageSummary(
  rule: Pick<AutomationRule, 'conditions' | 'conditionMatchMode' | 'actions' | 'scope'>,
  lookups: {
    jobStatuses: JobStatus[];
    taskTemplates: TaskTemplate[];
    notificationTemplates: NotificationTemplate[];
    customers: CustomerOption[];
    speeds: SpeedOption[];
  }
): string {
  if (rule.conditions.length === 0 && rule.actions.length === 0) {
    return 'No conditions or actions configured yet.';
  }

  const statusName = (id?: string) => {
    if (!id) return '(any)';
    return lookups.jobStatuses.find(s => s.id === id)?.name ?? 'unknown status';
  };
  const taskName = (id: string) => lookups.taskTemplates.find(t => t.id === id)?.name ?? 'a task';
  const notifName = (id: string) => lookups.notificationTemplates.find(n => n.id === id)?.name ?? 'a notification';

  // Build condition phrases
  const condPhrases = rule.conditions.map(c => {
    switch (c.type) {
      case 'job_unassigned': return 'a job is unassigned';
      case 'job_assigned': return 'a job is assigned';
      case 'before_scheduled_time': return `${c.offsetValue} ${c.offsetUnit} before the ${c.scheduledTimeField} time`;
      case 'after_scheduled_time': return `${c.offsetValue} ${c.offsetUnit} after the ${c.scheduledTimeField} time`;
      case 'at_scheduled_time': return `at the scheduled ${c.scheduledTimeField} time`;
      case 'status': {
        if (c.mode === 'any_change') return 'the job status changes';
        if (c.mode === 'changes_to') return `the job status changes to "${statusName(c.statusId)}"`;
        if (c.mode === 'leaves') return `the job leaves "${statusName(c.statusId)}" status`;
        if (c.mode === 'is_not') return `the job is not in "${statusName(c.statusId)}" status`;
        return 'a status change occurs';
      }
      case 'scan': {
        const types = c.scanTypes.map(t => SCAN_TYPE_OPTIONS.find(o => o.value === t)?.label ?? t);
        return types.length === 1 ? `a ${types[0]} occurs` : `a scan event occurs (${types.join(', ')})`;
      }
      default: return 'an unknown condition is met';
    }
  });

  // Build action phrases
  const actionPhrases = rule.actions.map(a => {
    switch (a.type) {
      case 'update_job_status': {
        if (a.fromStatusId) {
          return `change the job status from "${statusName(a.fromStatusId)}" to "${statusName(a.statusId)}"`;
        }
        return `set the job status to "${statusName(a.statusId)}"`;
      }
      case 'create_task': return `create a "${taskName(a.taskTemplateId)}" task`;
      case 'complete_task': return `complete the "${taskName(a.taskTemplateId)}" task`;
      case 'trigger_notification': return `send a "${notifName(a.notificationTemplateId)}" notification`;
      case 'send_sms': {
        const recipient = a.recipientType === 'driver' ? 'the driver'
          : a.recipientType === 'customer_contact' ? 'the customer contact'
          : `${a.fixedPhoneNumber || 'a fixed number'}`;
        const msg = a.messageContent ? ` saying "${a.messageContent.slice(0, 60)}${a.messageContent.length > 60 ? '...' : ''}"` : '';
        return `send an SMS to ${recipient}${msg}`;
      }
      default: return 'perform an unknown action';
    }
  });

  // Assemble
  let sentence = 'Based on your configuration: ';

  if (condPhrases.length > 0) {
    const joiner = rule.conditionMatchMode === 'all' ? ' and ' : ' or ';
    sentence += `when ${condPhrases.join(joiner)}, `;
  }

  if (actionPhrases.length > 0) {
    sentence += actionPhrases.join(', and ') + '.';
  } else {
    sentence += 'no actions will be taken (add at least one action).';
  }

  return sentence;
}
