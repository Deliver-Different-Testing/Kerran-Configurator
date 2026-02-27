// ============================================================================
// Type definitions matching the C# DTOs
// ============================================================================

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

export interface AppConfigCreateRequest {
  configKey: string;
  configValue: string | null;
  dataType: string;
  category: string;
  description: string | null;
}

export interface AppConfigUpdateRequest extends AppConfigCreateRequest {
  id: number;
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
  mirrorToAgentPortal: boolean;
  created: string;
  createdBy: string | null;
  lastModified: string | null;
  lastModifiedBy: string | null;
  scopeLabel: string;
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
}

export interface WorkflowTemplateCreateRequest {
  name: string;
  description: string | null;
  clientId: number | null;
  speedId: number | null;
  isActive: boolean;
  mirrorToAgentPortal: boolean;
  details: WorkflowTemplateDetailCreateRequest[];
}

export interface WorkflowTemplateDetailCreateRequest {
  statusId: number;
  eventTypeId: number;
  timeOffset: number;
  sequence: number;
  isActive: boolean;
}

export interface WorkflowNlpResponse {
  suggestedName: string;
  clientScope: string | null;
  serviceScope: string | null;
  steps: WorkflowNlpStepDto[];
  explanation: string;
  success: boolean;
  messages: { message: string }[];
}

export interface WorkflowNlpStepDto {
  eventTypeId: number | null;
  eventTypeName: string;
  sequence: number;
  statusId: number | null;
  stageTrigger: string;
  timeOffset: number;
}

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

export interface MobileConfigResponse {
  features: Record<string, boolean>;
  branding: Record<string, string>;
  supportTasks: { eventTypeId: number; name: string }[];
  success: boolean;
}

// Base API response wrapper
export interface ApiResponse<T = unknown> {
  messageId: string;
  success: boolean;
  messages: { message: string }[];
  data?: T;
  [key: string]: unknown;
}

// Stage triggers for the workflow editor
export const STAGE_TRIGGERS = [
  'Enroute to Pickup',
  'Pickup',
  'Enroute to Delivery',
  'Delivery',
] as const;

export type StageTrigger = (typeof STAGE_TRIGGERS)[number];

// ============================================================================
// Accessorial Workflow Task types (Phase 3c)
// Links AccessorialCharge → workflow steps that get injected into jobs
// ============================================================================

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

export interface AccessorialWorkflowTaskCreateRequest {
  accessorialChargeId: number;
  eventTypeId: number;
  stageId: number;
  sequence: number;
  required: boolean;
  configJson: string | null;
}

// ============================================================================
// Generic Fallback Renderer Pattern
// ============================================================================
//
// The DFRNT Drive MAUI app has native renderers for common step types:
//   - SignatureStep: native signature capture pad
//   - PhotoStep: camera with overlay guides
//   - BarcodeStep: barcode/QR scanner
//   - PODStep: proof-of-delivery composite
//
// For ANY event type that the app does NOT have a native renderer for,
// it should fall back to a GenericFallbackStep renderer. This renders:
//   1. A title and description from the event type name
//   2. Dynamic form fields parsed from ConfigJson (see schema below)
//   3. A photo capture button (always available)
//   4. A notes/comments text area (always available)
//   5. A "Complete" button to submit
//
// ConfigJson schema for generic steps:
// {
//   "fields": [
//     { "key": "temperature", "label": "Temperature (°C)", "type": "number", "required": true },
//     { "key": "condition", "label": "Package Condition", "type": "select", "options": ["Good","Damaged","Wet"] },
//     { "key": "notes", "label": "Additional Notes", "type": "text", "required": false }
//   ],
//   "requirePhoto": true,
//   "requireSignature": false,
//   "instructions": "Please record the temperature and condition of the package."
// }
//
// This means new workflow step types can be added via configuration alone —
// no app update required. The admin creates a new TucEventType, sets up
// ConfigJson with the field schema, and it renders automatically.
// ============================================================================

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
  options?: string[]; // for 'select' type
  placeholder?: string;
  defaultValue?: string;
}

// Stage ID constants matching SQL definition
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
