// Maps frontend task IDs to backend event type names (must match seeded data in migration 010)
export const TASK_TO_EVENT_TYPE_NAME: Record<string, string> = {
  'photo': 'Photo Capture',
  'signature': 'Signature',
  'checkbox': 'Checkbox Confirmation',
  'age': 'Age Verification',
  'idverify': 'ID Verification',
  'templogger': 'Temperature Logger',
  'barcode': 'Barcode Scan',
  'prompt': 'Custom Prompt',
  'notes': 'Notes',
  'dropdown': 'Dropdown Select',
  'geofence': 'Geofence Check',
  'timestamp': 'Time Stamp',
  'docupload': 'Document Upload',
  'clientnote': 'Client Note',
  'coldchain': 'Cold Chain Check',
  'instructionnote': 'Instruction Note',
};

// Reverse map: event type name → frontend task ID
export const EVENT_TYPE_NAME_TO_TASK: Record<string, string> = Object.fromEntries(
  Object.entries(TASK_TO_EVENT_TYPE_NAME).map(([k, v]) => [v, k])
);

// Built at runtime from API lookups: frontend task ID → backend event type ID
let taskToEventTypeId: Record<string, number> = {};
let eventTypeIdToTask: Record<number, string> = {};

export function buildIdMaps(eventTypes: Array<{ id: number; name: string }>) {
  taskToEventTypeId = {};
  eventTypeIdToTask = {};
  for (const et of eventTypes) {
    const taskId = EVENT_TYPE_NAME_TO_TASK[et.name];
    if (taskId) {
      taskToEventTypeId[taskId] = et.id;
      eventTypeIdToTask[et.id] = taskId;
    }
  }
  const mappedCount = Object.keys(taskToEventTypeId).length;
  console.log(`[WorkflowMaps] buildIdMaps: ${mappedCount}/${eventTypes.length} event types mapped to tasks`);
  if (mappedCount === 0 && eventTypes.length > 0) {
    console.warn('[WorkflowMaps] WARNING: Zero event types mapped — check that migration 010 has been run and event type names match');
  }
}

export function getEventTypeId(taskId: string): number | undefined {
  return taskToEventTypeId[taskId];
}

export function getTaskId(eventTypeId: number): string | undefined {
  return eventTypeIdToTask[eventTypeId];
}
