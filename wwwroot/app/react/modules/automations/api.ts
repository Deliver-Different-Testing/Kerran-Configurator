/**
 * Automation Engine API Client
 *
 * Uses the shared request() function from services/api.ts which includes
 * the X-Requested-With header required by the CSRF middleware.
 */

import type {
  AutomationRule,
  CustomerOption,
  SpeedOption,
  SiteOption,
  RegionOption,
  JobStatus,
  TaskTemplate,
  NotificationTemplate,
  Condition,
  Action,
  ConditionMatchMode,
  AutomationScope,
  EmailRecipientType,
  ReportOption,
  JobRelationshipFilter,
} from './types';
import { lookupApi, workflowApi, eventTypeApi } from '../../services/api';

// ---------------------------------------------------------------------------
// Shared request helper (same pattern as services/api.ts)
// ---------------------------------------------------------------------------

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Types — Backend DTOs
// ---------------------------------------------------------------------------

export interface ApiAutomationRule {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  conditionMatchMode: string;
  scope: {
    allCustomers: boolean;
    customerIds: number[];
    allSpeeds: boolean;
    speedIds: number[];
    jobRelationship: string | null;
    allJobStatuses: boolean;
    jobStatusIds: number[];
    allPriorities: boolean;
    priorityIds: number[];
    allFromSites: boolean;
    fromSiteIds: number[];
    allToSites: boolean;
    toSiteIds: number[];
    allFromRegions: boolean;
    fromRegionIds: number[];
    allToRegions: boolean;
    toRegionIds: number[];
    timeThreshold: number | null;
  };
  conditions: ApiCondition[];
  actions: ApiAction[];
  createdDate: string;
  modifiedDate: string | null;
}

export interface ApiCondition {
  id: number | null;
  conditionType: string;
  sortOrder: number;
  jobTypeFilter: string;
  statusConditionMode: string | null;
  statusId: number | null;
  scheduledTimeField: string | null;
  offsetValue: number | null;
  offsetUnit: string | null;
  scanTypes: string[] | null;
}

export interface ApiAction {
  id: number | null;
  actionType: string;
  sortOrder: number;
  toStatusId: number | null;
  fromStatusId: number | null;
  taskTemplateId: number | null;
  taskAssigneeId: number | null;
  taskAssigneeGroupId: number | null;
  taskDueOffsetMinutes: number | null;
  notificationTemplateId: number | null;
  smsRecipientType: string | null;
  smsFixedNumber: string | null;
  smsMessageContent: string | null;
  emailSubject: string | null;
  emailTemplate: string | null;
  replyToEmail: string | null;
  emailRecipient: string | null;
  customEmailAddresses: string | null;
  attachReportKey: string | null;
  // Wait condition fields (for workflow chaining)
  waitConditionType: string | null;
  waitStatusMode: string | null;
  waitStatusId: number | null;
  waitScheduledTimeField: string | null;
  waitOffsetValue: number | null;
  waitOffsetUnit: string | null;
  waitScanTypes: string[] | null;
}

export interface ApiExecutionLog {
  id: number;
  ruleId: number;
  ruleName: string;
  jobId: number | null;
  evaluatedAt: string;
  conditionsMet: boolean;
  triggerType: string;
  triggerDetail: string | null;
  actionsExecuted: number;
  actionsSummary: string | null;
  errorMessage: string | null;
  durationMs: number;
  actionDetails: {
    id: number;
    actionType: string;
    success: boolean;
    detail: string | null;
    errorMessage: string | null;
    durationMs: number;
  }[];
}

// ---------------------------------------------------------------------------
// Automation Rule CRUD
// ---------------------------------------------------------------------------

export interface ListAutomationsParams {
  customerId?: number;
  speedId?: number;
  search?: string;
  isActive?: boolean;
}

export async function fetchAutomations(
  params?: ListAutomationsParams,
): Promise<ApiAutomationRule[]> {
  const qs = new URLSearchParams();
  if (params?.customerId != null) qs.set('customerId', String(params.customerId));
  if (params?.speedId != null) qs.set('speedId', String(params.speedId));
  if (params?.search) qs.set('search', params.search);
  if (params?.isActive != null) qs.set('isActive', String(params.isActive));
  const query = qs.toString();
  return request<ApiAutomationRule[]>(`/automations${query ? `?${query}` : ''}`);
}

export async function fetchAutomation(id: number): Promise<ApiAutomationRule> {
  return request<ApiAutomationRule>(`/automations/${id}`);
}

export async function createAutomation(
  rule: Omit<ApiAutomationRule, 'id' | 'createdDate' | 'modifiedDate'>,
): Promise<ApiAutomationRule> {
  return request<ApiAutomationRule>('/automations', {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export async function updateAutomation(
  id: number,
  rule: Omit<ApiAutomationRule, 'id' | 'createdDate' | 'modifiedDate'>,
): Promise<ApiAutomationRule> {
  return request<ApiAutomationRule>(`/automations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(rule),
  });
}

export async function deleteAutomation(id: number): Promise<void> {
  await request<void>(`/automations/${id}`, { method: 'DELETE' });
}

export async function toggleAutomation(id: number): Promise<void> {
  await request<void>(`/automations/${id}/toggle`, { method: 'POST' });
}

export async function testAutomation(
  id: number,
  jobId: number,
): Promise<ApiExecutionLog> {
  return request<ApiExecutionLog>(
    `/automations/${id}/test?jobId=${jobId}`,
    { method: 'POST' },
  );
}

export async function fetchExecutionLogs(params?: {
  ruleId?: number;
  jobId?: number;
  from?: string;
  to?: string;
  triggerType?: string;
  conditionsMet?: boolean;
  skip?: number;
  take?: number;
}): Promise<ApiExecutionLog[]> {
  const qs = new URLSearchParams();
  if (params?.ruleId != null) qs.set('ruleId', String(params.ruleId));
  if (params?.jobId != null) qs.set('jobId', String(params.jobId));
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.triggerType) qs.set('triggerType', params.triggerType);
  if (params?.conditionsMet != null) qs.set('conditionsMet', String(params.conditionsMet));
  if (params?.skip != null) qs.set('skip', String(params.skip));
  if (params?.take != null) qs.set('take', String(params.take));
  const query = qs.toString();
  return request<ApiExecutionLog[]>(`/automations/logs${query ? `?${query}` : ''}`);
}

// ---------------------------------------------------------------------------
// Reference data endpoints — wired to existing lookup APIs where possible
// ---------------------------------------------------------------------------

export async function fetchCustomers(): Promise<CustomerOption[]> {
  // NOTE: This loads ALL customers. Use searchCustomers() for large datasets.
  try {
    const data = await lookupApi.getClients();
    return data.clients.map(c => ({
      id: String(c.id),
      name: c.name,
      shortName: c.code || c.name,
    }));
  } catch {
    return [];
  }
}

/** Server-side customer search — returns up to `limit` matches for the query. */
export async function searchCustomers(query: string, limit = 20): Promise<CustomerOption[]> {
  try {
    const data = await lookupApi.searchClients(query, limit);
    return data.clients.map(c => ({
      id: String(c.id),
      name: c.name,
      shortName: c.code || c.name,
    }));
  } catch {
    return [];
  }
}

/** Fetch specific customers by ID — for resolving selected IDs to display names. */
export async function fetchCustomersByIds(ids: string[]): Promise<CustomerOption[]> {
  if (ids.length === 0) return [];
  try {
    const numericIds = ids.map(Number).filter(n => !isNaN(n));
    const data = await lookupApi.getClientsByIds(numericIds);
    return data.clients.map(c => ({
      id: String(c.id),
      name: c.name,
      shortName: c.code || c.name,
    }));
  } catch {
    return [];
  }
}

export async function fetchSpeeds(): Promise<SpeedOption[]> {
  try {
    const data = await lookupApi.getServices();
    return data.services.map(s => ({
      id: String(s.id),
      name: s.name,
      code: s.code || '',
    }));
  } catch {
    return [];
  }
}

export async function fetchJobStatuses(): Promise<JobStatus[]> {
  try {
    const data = await workflowApi.getLookups();
    return data.jobStatuses.map(s => ({
      id: String(s.id),
      name: s.name,
      code: '',
    }));
  } catch {
    return [];
  }
}

export async function fetchTaskTemplates(): Promise<TaskTemplate[]> {
  try {
    const data = await eventTypeApi.getAll();
    return data.eventTypes.map(e => ({
      id: String(e.id),
      name: e.name,
    }));
  } catch {
    return [];
  }
}

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  try {
    const data = await eventTypeApi.getAll();
    return data.eventTypes.map(e => ({
      id: String(e.id),
      name: e.name,
      type: 'single' as const,
    }));
  } catch {
    return [];
  }
}

export async function fetchSites(): Promise<SiteOption[]> {
  try {
    const data = await lookupApi.getSites();
    return data.sites.map(s => ({
      id: String(s.id),
      name: s.name,
    }));
  } catch {
    return [];
  }
}

export async function fetchRegions(): Promise<RegionOption[]> {
  try {
    const data = await lookupApi.getRegions();
    return data.regions.map(r => ({
      id: String(r.id),
      name: r.name,
    }));
  } catch {
    return [];
  }
}

export async function fetchAvailableReports(): Promise<ReportOption[]> {
  try {
    return await request<ReportOption[]>('/automations/available-reports');
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// DTO <-> Frontend type mappers
// ---------------------------------------------------------------------------

export function apiRuleToFrontend(api: ApiAutomationRule): AutomationRule {
  return {
    id: String(api.id),
    name: api.name,
    description: api.description ?? undefined,
    isActive: api.isActive,
    conditionMatchMode: api.conditionMatchMode as ConditionMatchMode,
    scope: {
      allCustomers: api.scope.allCustomers,
      customerIds: api.scope.customerIds.map(String),
      allSpeeds: api.scope.allSpeeds,
      speedIds: api.scope.speedIds.map(String),
      jobRelationship: (api.scope.jobRelationship as JobRelationshipFilter) ?? 'all',
      allJobStatuses: api.scope.allJobStatuses ?? false,
      jobStatusIds: (api.scope.jobStatusIds ?? []).map(String),
      allPriorities: api.scope.allPriorities ?? false,
      priorityIds: (api.scope.priorityIds ?? []).map(String),
      allFromSites: api.scope.allFromSites ?? false,
      fromSiteIds: (api.scope.fromSiteIds ?? []).map(String),
      allToSites: api.scope.allToSites ?? false,
      toSiteIds: (api.scope.toSiteIds ?? []).map(String),
      allFromRegions: api.scope.allFromRegions ?? false,
      fromRegionIds: (api.scope.fromRegionIds ?? []).map(String),
      allToRegions: api.scope.allToRegions ?? false,
      toRegionIds: (api.scope.toRegionIds ?? []).map(String),
      timeThreshold: api.scope.timeThreshold ?? undefined,
    },
    conditions: api.conditions.map(apiConditionToFrontend),
    actions: api.actions.map(apiActionToFrontend),
    createdAt: api.createdDate,
    updatedAt: api.modifiedDate ?? api.createdDate,
  };
}

function apiConditionToFrontend(c: ApiCondition): Condition {
  const base = {
    id: c.id != null ? String(c.id) : `cond-${Date.now()}-${Math.random()}`,
    jobTypeFilter: mapJobTypeFilter(c.jobTypeFilter),
  };

  const ct = c.conditionType.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();

  switch (ct) {
    case 'jobunassigned':
    case 'job_unassigned':
      return { ...base, type: 'job_unassigned' };
    case 'jobassigned':
    case 'job_assigned':
      return { ...base, type: 'job_assigned' };
    case 'beforescheduledtime':
    case 'before_scheduled_time':
      return {
        ...base,
        type: 'before_scheduled_time',
        scheduledTimeField: (c.scheduledTimeField?.toLowerCase() ?? 'pickup') as 'pickup' | 'delivery' | 'flight',
        offsetValue: c.offsetValue ?? 0,
        offsetUnit: (c.offsetUnit ?? 'minutes') as 'minutes' | 'hours',
      };
    case 'afterscheduledtime':
    case 'after_scheduled_time':
      return {
        ...base,
        type: 'after_scheduled_time',
        scheduledTimeField: (c.scheduledTimeField?.toLowerCase() ?? 'pickup') as 'pickup' | 'delivery' | 'flight',
        offsetValue: c.offsetValue ?? 0,
        offsetUnit: (c.offsetUnit ?? 'minutes') as 'minutes' | 'hours',
      };
    case 'atscheduledtime':
    case 'at_scheduled_time':
      return {
        ...base,
        type: 'at_scheduled_time',
        scheduledTimeField: (c.scheduledTimeField?.toLowerCase() ?? 'pickup') as 'pickup' | 'delivery' | 'flight',
      };
    case 'status':
      return {
        ...base,
        type: 'status',
        mode: mapStatusMode(c.statusConditionMode),
        statusId: c.statusId != null ? String(c.statusId) : undefined,
      };
    case 'scan':
      return {
        ...base,
        type: 'scan',
        scanTypes: (c.scanTypes ?? []) as Condition extends { type: 'scan'; scanTypes: infer S } ? S : never,
      };
    default:
      return { ...base, type: 'job_unassigned' };
  }
}

function mapJobTypeFilter(s: string): 'all' | 'child_1_pickup' | 'child_2_flight' | 'child_3_delivery' | 'standard' {
  switch (s.toLowerCase()) {
    case 'pickup': return 'child_1_pickup';
    case 'delivery': return 'child_3_delivery';
    case 'transfer': return 'child_2_flight';
    default: return 'all';
  }
}

function mapStatusMode(s: string | null): 'any_change' | 'changes_to' | 'leaves' | 'is_not' {
  if (!s) return 'any_change';
  switch (s.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()) {
    case 'anychange':
    case 'any_change': return 'any_change';
    case 'changesto':
    case 'changes_to': return 'changes_to';
    case 'leaves': return 'leaves';
    case 'isnot':
    case 'is_not': return 'is_not';
    default: return 'any_change';
  }
}

function mapEmailRecipient(s: string | null): string {
  if (!s) return 'tracking_email';
  switch (s) {
    case 'TrackingEmail': return 'tracking_email';
    case 'ProofOfDeliveryEmail': return 'pod_email';
    case 'ClientContactEmail': return 'client_contact_email';
    case 'AgentEmail': return 'agent_email';
    case 'Custom': return 'custom';
    default: return 'tracking_email';
  }
}

function mapEmailRecipientToApi(s: string): string {
  switch (s) {
    case 'tracking_email': return 'TrackingEmail';
    case 'pod_email': return 'ProofOfDeliveryEmail';
    case 'client_contact_email': return 'ClientContactEmail';
    case 'agent_email': return 'AgentEmail';
    case 'custom': return 'Custom';
    default: return 'TrackingEmail';
  }
}

function apiActionToFrontend(a: ApiAction): Action {
  const base = {
    id: a.id != null ? String(a.id) : `action-${Date.now()}-${Math.random()}`,
  };

  const at = a.actionType.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();

  switch (at) {
    case 'updatejobstatus':
    case 'update_job_status':
    // Legacy ChangeStatus actions are now mapped to update_job_status with fromStatusId
    case 'changestatus':
    case 'change_status':
      return {
        ...base,
        type: 'update_job_status',
        statusId: String(a.toStatusId ?? ''),
        fromStatusId: a.fromStatusId != null ? String(a.fromStatusId) : undefined,
      };
    case 'createtask':
    case 'create_task':
      return {
        ...base,
        type: 'create_task',
        taskTemplateId: String(a.taskTemplateId ?? ''),
        assigneeId: a.taskAssigneeId != null ? String(a.taskAssigneeId) : undefined,
        assigneeGroupId: a.taskAssigneeGroupId != null ? String(a.taskAssigneeGroupId) : undefined,
        dueTimeOffsetMinutes: a.taskDueOffsetMinutes ?? undefined,
      };
    case 'completetask':
    case 'complete_task':
      return { ...base, type: 'complete_task', taskTemplateId: String(a.taskTemplateId ?? '') };
    case 'triggernotification':
    case 'trigger_notification':
      return { ...base, type: 'trigger_notification', notificationTemplateId: String(a.notificationTemplateId ?? '') };
    case 'sendsms':
    case 'send_sms':
      return {
        ...base,
        type: 'send_sms',
        recipientType: (a.smsRecipientType?.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase() ?? 'customer_contact') as 'customer_contact' | 'driver' | 'fixed_number',
        fixedPhoneNumber: a.smsFixedNumber ?? undefined,
        messageContent: a.smsMessageContent ?? '',
      };
    case 'waitforcondition':
    case 'wait_for_condition':
      return {
        ...base,
        type: 'wait_for_condition',
        waitConditionType: (a.waitConditionType?.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase() ?? 'status') as any,
        waitStatusMode: a.waitStatusMode ? mapStatusMode(a.waitStatusMode) : undefined,
        waitStatusId: a.waitStatusId != null ? String(a.waitStatusId) : undefined,
        waitScheduledTimeField: a.waitScheduledTimeField?.toLowerCase() as any,
        waitOffsetValue: a.waitOffsetValue ?? undefined,
        waitOffsetUnit: a.waitOffsetUnit as any,
        waitScanTypes: (a.waitScanTypes ?? []) as any,
      };
    case 'sendemail':
    case 'send_email':
      return {
        ...base,
        type: 'send_email',
        emailRecipient: mapEmailRecipient(a.emailRecipient) as EmailRecipientType,
        emailSubject: a.emailSubject ?? '',
        emailTemplate: a.emailTemplate ?? '',
        replyToEmail: a.replyToEmail ?? undefined,
        customEmailAddresses: a.customEmailAddresses ?? undefined,
        attachReportKey: a.attachReportKey ?? undefined,
      };
    default:
      return { ...base, type: 'update_job_status', statusId: '' };
  }
}

export function frontendRuleToApi(
  rule: AutomationRule,
): Omit<ApiAutomationRule, 'id' | 'createdDate' | 'modifiedDate'> {
  return {
    name: rule.name,
    description: rule.description ?? null,
    isActive: rule.isActive,
    conditionMatchMode: rule.conditionMatchMode,
    scope: {
      allCustomers: rule.scope.allCustomers,
      customerIds: rule.scope.customerIds.map(Number).filter((n) => !isNaN(n)),
      allSpeeds: rule.scope.allSpeeds,
      speedIds: rule.scope.speedIds.map(Number).filter((n) => !isNaN(n)),
      jobRelationship: rule.scope.jobRelationship !== 'all' ? rule.scope.jobRelationship : null,
      allJobStatuses: rule.scope.allJobStatuses,
      jobStatusIds: rule.scope.jobStatusIds.map(Number).filter((n) => !isNaN(n)),
      allPriorities: rule.scope.allPriorities,
      priorityIds: rule.scope.priorityIds.map(Number).filter((n) => !isNaN(n)),
      allFromSites: rule.scope.allFromSites,
      fromSiteIds: rule.scope.fromSiteIds.map(Number).filter((n) => !isNaN(n)),
      allToSites: rule.scope.allToSites,
      toSiteIds: rule.scope.toSiteIds.map(Number).filter((n) => !isNaN(n)),
      allFromRegions: rule.scope.allFromRegions,
      fromRegionIds: rule.scope.fromRegionIds.map(Number).filter((n) => !isNaN(n)),
      allToRegions: rule.scope.allToRegions,
      toRegionIds: rule.scope.toRegionIds.map(Number).filter((n) => !isNaN(n)),
      timeThreshold: rule.scope.timeThreshold ?? null,
    },
    conditions: rule.conditions.map((c, i) => frontendConditionToApi(c, i)),
    actions: rule.actions.map((a, i) => frontendActionToApi(a, i)),
  };
}

function frontendConditionToApi(c: Condition, index: number): ApiCondition {
  const base: ApiCondition = {
    id: null,
    conditionType: c.type.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(''),
    sortOrder: index + 1,
    jobTypeFilter: mapJobTypeFilterToApi(c.jobTypeFilter),
    statusConditionMode: null,
    statusId: null,
    scheduledTimeField: null,
    offsetValue: null,
    offsetUnit: null,
    scanTypes: null,
  };

  switch (c.type) {
    case 'before_scheduled_time':
    case 'after_scheduled_time':
      base.scheduledTimeField = c.scheduledTimeField.charAt(0).toUpperCase() + c.scheduledTimeField.slice(1);
      base.offsetValue = c.offsetValue;
      base.offsetUnit = c.offsetUnit;
      break;
    case 'at_scheduled_time':
      base.scheduledTimeField = c.scheduledTimeField.charAt(0).toUpperCase() + c.scheduledTimeField.slice(1);
      break;
    case 'status':
      base.statusConditionMode = c.mode.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
      base.statusId = c.statusId != null ? Number(c.statusId) : null;
      break;
    case 'scan':
      base.scanTypes = c.scanTypes as string[];
      break;
  }

  return base;
}

function mapJobTypeFilterToApi(s: string): string {
  switch (s) {
    case 'child_1_pickup': return 'Pickup';
    case 'child_2_flight': return 'Transfer';
    case 'child_3_delivery': return 'Delivery';
    case 'standard': return 'Collection';
    default: return 'All';
  }
}

function frontendActionToApi(a: Action, index: number): ApiAction {
  const base: ApiAction = {
    id: null,
    actionType: a.type.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(''),
    sortOrder: index + 1,
    toStatusId: null,
    fromStatusId: null,
    taskTemplateId: null,
    taskAssigneeId: null,
    taskAssigneeGroupId: null,
    taskDueOffsetMinutes: null,
    notificationTemplateId: null,
    smsRecipientType: null,
    smsFixedNumber: null,
    smsMessageContent: null,
    emailSubject: null,
    emailTemplate: null,
    replyToEmail: null,
    emailRecipient: null,
    customEmailAddresses: null,
    attachReportKey: null,
    waitConditionType: null,
    waitStatusMode: null,
    waitStatusId: null,
    waitScheduledTimeField: null,
    waitOffsetValue: null,
    waitOffsetUnit: null,
    waitScanTypes: null,
  };

  switch (a.type) {
    case 'update_job_status':
      base.toStatusId = Number(a.statusId) || null;
      base.fromStatusId = a.fromStatusId ? Number(a.fromStatusId) : null;
      break;
    case 'create_task':
      base.taskTemplateId = Number(a.taskTemplateId) || null;
      base.taskAssigneeId = a.assigneeId ? Number(a.assigneeId) : null;
      base.taskAssigneeGroupId = a.assigneeGroupId ? Number(a.assigneeGroupId) : null;
      base.taskDueOffsetMinutes = a.dueTimeOffsetMinutes ?? null;
      break;
    case 'complete_task':
      base.taskTemplateId = Number(a.taskTemplateId) || null;
      break;
    case 'trigger_notification':
      base.notificationTemplateId = Number(a.notificationTemplateId) || null;
      break;
    case 'send_sms':
      base.smsRecipientType = a.recipientType.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
      base.smsFixedNumber = a.fixedPhoneNumber ?? null;
      base.smsMessageContent = a.messageContent;
      break;
    case 'send_email':
      base.emailRecipient = mapEmailRecipientToApi(a.emailRecipient);
      base.emailSubject = a.emailSubject;
      base.emailTemplate = a.emailTemplate;
      base.replyToEmail = a.replyToEmail ?? null;
      base.customEmailAddresses = a.customEmailAddresses ?? null;
      base.attachReportKey = a.attachReportKey ?? null;
      break;
    case 'wait_for_condition':
      base.waitConditionType = a.waitConditionType.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
      base.waitStatusMode = a.waitStatusMode ? a.waitStatusMode.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('') : null;
      base.waitStatusId = a.waitStatusId ? Number(a.waitStatusId) : null;
      base.waitScheduledTimeField = a.waitScheduledTimeField ? a.waitScheduledTimeField.charAt(0).toUpperCase() + a.waitScheduledTimeField.slice(1) : null;
      base.waitOffsetValue = a.waitOffsetValue ?? null;
      base.waitOffsetUnit = a.waitOffsetUnit ?? null;
      base.waitScanTypes = a.waitScanTypes ?? null;
      break;
  }

  return base;
}
