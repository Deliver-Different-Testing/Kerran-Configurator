// ============================================================================
// Transformers: convert between backend DTOs and frontend StagesMap
// ============================================================================

import type {
  WorkflowTemplateDetailDto,
  WorkflowTemplateDetailCreateRequest,
  StagesMap,
  StageTask,
  StageName,
  StepContext,
  LookupItem,
} from '../types/configurator';
import { getTaskId, getEventTypeId } from '../data/taskEventTypeMap';
import { TASK_MAP } from '../data/tasks';

// The 4 pipeline stage names — must exactly match seeded values from migration 011
const STAGE_NAMES: StageName[] = ['Enroute to Pickup', 'Pickup', 'Enroute to Delivery', 'Delivery'];
const STAGE_NAME_SET = new Set<string>(STAGE_NAMES);

// StageName → status ID mapping (built from lookups)
let stageNameToStatusId: Record<string, number> = {};

export function buildStatusIdMap(jobStatuses: LookupItem[]) {
  stageNameToStatusId = {};

  for (const s of jobStatuses) {
    if (STAGE_NAME_SET.has(s.name)) {
      stageNameToStatusId[s.name] = s.id;
    }
  }

  const mappedCount = Object.keys(stageNameToStatusId).length;
  console.log(`[WorkflowMaps] buildStatusIdMap: ${mappedCount}/4 stages mapped from ${jobStatuses.length} job statuses`);

  if (mappedCount > 0) {
    const matched = Object.entries(stageNameToStatusId).map(([name, id]) => `"${name}" (id=${id})`);
    console.log('[WorkflowMaps] Matched statuses:', matched);
  }

  if (mappedCount < 4) {
    const missing = STAGE_NAMES.filter(s => !stageNameToStatusId[s]);
    console.warn(`[WorkflowMaps] Missing stage mappings: ${missing.join(', ')}. Run migration 011-seed-workflow-stage-statuses.sql to add them.`);
    console.warn('[WorkflowMaps] Available DB statuses:', jobStatuses.map(s => s.name));
  }
}

/**
 * Convert flat backend detail DTOs into the frontend StagesMap structure.
 */
export function detailsToStagesMap(details: WorkflowTemplateDetailDto[]): StagesMap {
  const stages: StagesMap = {};

  const sorted = [...details]
    .filter(d => d.isActive)
    .sort((a, b) => a.sequence - b.sequence);

  for (const d of sorted) {
    if (!STAGE_NAME_SET.has(d.statusName)) continue;
    const stageName = d.statusName as StageName;

    const taskId = getTaskId(d.eventTypeId);
    if (!taskId) continue;

    // Parse config from ConfigJson, fallback to task defaults
    let config = { ...TASK_MAP.get(taskId)?.config };
    if (d.configJson) {
      try {
        const parsed = JSON.parse(d.configJson);
        config = { ...config, ...parsed };
      } catch {
        // ignore invalid JSON
      }
    }

    if (!stages[stageName]) stages[stageName] = [];
    stages[stageName]!.push({
      taskId,
      required: d.required,
      config,
      context: (d.context as StepContext) || 'both',
    });
  }

  return stages;
}

/**
 * Convert frontend StagesMap back to flat detail create requests for the backend.
 */
export function stagesMapToDetails(stages: StagesMap): WorkflowTemplateDetailCreateRequest[] {
  const details: WorkflowTemplateDetailCreateRequest[] = [];
  const stageOrder: StageName[] = ['Enroute to Pickup', 'Pickup', 'Enroute to Delivery', 'Delivery'];
  let sequence = 1;

  for (const stageName of stageOrder) {
    const tasks = stages[stageName];
    if (!tasks) continue;

    const statusId = stageNameToStatusId[stageName];
    if (!statusId) {
      console.warn(`[WorkflowMaps] stagesMapToDetails: no statusId for stage "${stageName}" — skipping ${tasks.length} task(s)`);
      continue;
    }

    for (const task of tasks) {
      const eventTypeId = getEventTypeId(task.taskId);
      if (!eventTypeId) {
        console.warn(`[WorkflowMaps] stagesMapToDetails: no eventTypeId for task "${task.taskId}" — skipping`);
        continue;
      }

      details.push({
        statusId,
        eventTypeId,
        timeOffset: 0,
        sequence: sequence++,
        isActive: true,
        required: task.required,
        configJson: JSON.stringify({ taskTypeId: task.taskId, ...task.config }),
        context: task.context || 'both',
      });
    }
  }

  return details;
}

/**
 * Count total tasks across all stages in a StagesMap.
 */
export function countStageTasks(stages: StagesMap): number {
  let count = 0;
  for (const tasks of Object.values(stages)) {
    if (tasks) count += tasks.length;
  }
  return count;
}
