// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
import { mockRecruitmentStages } from './np_devData';
import type { RecruitmentStageConfig } from '@/types';

export const recruitmentSettingsService = {
  getStages(): RecruitmentStageConfig[] {
    return [...mockRecruitmentStages].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  createStage(_stage: Partial<RecruitmentStageConfig>): RecruitmentStageConfig {
    throw new Error('createStage() not yet wired to backend');
  },

  updateStage(_id: number, _updates: Partial<RecruitmentStageConfig>): RecruitmentStageConfig | undefined {
    return undefined;
  },

  deleteStage(_id: number): boolean {
    return false;
  },

  seedDefaults(): RecruitmentStageConfig[] {
    return mockRecruitmentStages;
  },
};
