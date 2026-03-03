// ── Frontend UI Types ──

export interface TaskConfig {
  minPhotos?: number;
  maxPhotos?: number;
  label?: string;
  mandatory?: string;
  signerNameReq?: boolean;
  minAge?: number;
  idTypes?: string[];
  matchField?: string;
  action?: string;
  scanRequired?: boolean;
  mustMatch?: boolean;
  message?: string;
  acknowledge?: boolean;
  required?: boolean;
  options?: string[];
  radius?: number;
  mode?: string;
  docType?: string;
  note?: string;
  minTemp?: number;
  maxTemp?: number;
  requirePhoto?: boolean;
}

export interface TaskType {
  id: string;
  icon: string;
  name: string;
  desc: string;
  cat: 'Capture' | 'Verification' | 'Confirmation' | 'Communication';
  config: TaskConfig;
}

export interface StageTask {
  taskId: string;
  required: boolean;
  config: TaskConfig;
  context: StepContext;
}

export type StageName = 'Enroute to Pickup' | 'Pickup' | 'Enroute to Delivery' | 'Delivery';

export type StagesMap = Partial<Record<StageName, StageTask[]>>;

export interface PresetWorkflow {
  name: string;
  stages: StagesMap;
}

// ── Supports ──

export interface SupportType {
  id: string;
  icon: string;
  color: string;
  name: string;
  desc: string;
  enabled: boolean;
  order: number;
}

// ── Feature Flags ──

export interface FeatureFlag {
  id: string;
  icon: string;
  name: string;
  desc: string;
  enabled: boolean;
  overrides: number;
}

// ── Scope ──

export type AppliesToScope = 'default' | 'client' | 'service' | 'both' | 'np';

// ── Backend API DTOs ──

export interface AppConfigDto {
  id: number;
  configKey: string;
  configValue: string | null;
  dataType: string;
  category: string;
  description: string | null;
  isActive: boolean;
  created: string;
  createdBy: string | null;
  lastModified: string | null;
  lastModifiedBy: string | null;
}

export interface WorkflowTemplateDto {
  id: number;
  name: string;
  description: string | null;
  clientId: number | null;
  clientName: string | null;
  speedId: number | null;
  speedName: string | null;
  isActive: boolean;
  created: string;
  createdBy: string | null;
  lastModified: string | null;
  lastModifiedBy: string | null;
  scopeLabel: string;
  mirrorToAgentPortal: boolean;
  stepCount: number;
  details: WorkflowTemplateDetailDto[];
}

export interface WorkflowTemplateDetailDto {
  id: number;
  templateId: number;
  statusId: number;
  statusName: string;
  eventTypeId: number;
  eventTypeName: string;
  timeOffset: number;
  sequence: number;
  isActive: boolean;
  required: boolean;
  configJson: string | null;
  context: StepContext;
}

export type StepContext = 'app' | 'portal' | 'both';

export interface WorkflowTemplateCreateRequest {
  name: string;
  description?: string;
  clientId?: number | null;
  speedId?: number | null;
  isActive?: boolean;
  mirrorToAgentPortal?: boolean;
  details: WorkflowTemplateDetailCreateRequest[];
}

export interface WorkflowTemplateDetailCreateRequest {
  statusId: number;
  eventTypeId: number;
  timeOffset: number;
  sequence: number;
  isActive: boolean;
  required: boolean;
  configJson: string | null;
  context: StepContext;
}

export interface LookupItem {
  id: number;
  name: string;
}

export interface WorkflowLookupsResponse {
  messageId: string;
  success: boolean;
  messages: Array<{ message: string }>;
  eventTypes: LookupItem[];
  jobStatuses: LookupItem[];
}

// ── Lookup DTOs ──

export interface ClientLookupDto {
  id: number;
  name: string;
  code: string;
}

export interface ServiceLookupDto {
  id: number;
  name: string;
  code: string;
}

// ── Event Type DTOs ──

export interface EventTypeDto {
  id: number;
  name: string;
  group: string | null;
}

export interface EventTypeGroupMappingDto {
  id: number;
  eventTypeId: number;
  eventTypeGroupId: number;
  eventTypeName: string;
  groupName: string;
  sequence: number;
  isActive: boolean;
}

// ── API Response Wrapper ──

export interface ApiResponse<T = unknown> {
  messageId: string;
  success: boolean;
  messages: Array<{ message: string }>;
  data?: T;
  [key: string]: unknown;
}

// ── Stage Constants ──

export const STAGE_NAMES: StageName[] = [
  'Enroute to Pickup',
  'Pickup',
  'Enroute to Delivery',
  'Delivery',
];

export const STAGE_IDS = {
  ENROUTE_TO_PICKUP: 1,
  PICKUP: 2,
  ENROUTE_TO_DELIVERY: 3,
  DELIVERY: 4,
} as const;

export const STAGE_ID_NAMES: Record<number, string> = {
  1: 'Enroute to Pickup',
  2: 'Pickup',
  3: 'Enroute to Delivery',
  4: 'Delivery',
};

// ── Accessorial Workflow Task types ──

export interface AccessorialWorkflowTaskDto {
  id: number;
  accessorialChargeId: number;
  accessorialChargeName: string | null;
  eventTypeId: number;
  eventTypeName: string | null;
  stageId: number;
  stageName: string;
  sequence: number;
  required: boolean;
  configJson: string | null;
  active: boolean;
}

// ── Generic Fallback Renderer Pattern ──

export interface GenericFallbackStepConfig {
  fields: GenericFallbackField[];
  requirePhoto?: boolean;
  requireSignature?: boolean;
  instructions?: string;
}

export interface GenericFallbackField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'time';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
}
