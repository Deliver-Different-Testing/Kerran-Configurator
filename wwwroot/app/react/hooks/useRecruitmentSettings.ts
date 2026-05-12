import { useState, useMemo, useCallback } from 'react';
import { recruitmentSettingsService } from '@/services/np_recruitmentSettingsService';
import type { RecruitmentStageConfig } from '@/types';

export function useRecruitmentSettings() {
  const [refreshKey, setRefreshKey] = useState(0);
  const stages = useMemo(() => recruitmentSettingsService.getStages(), [refreshKey]);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const createStage = useCallback((data: Partial<RecruitmentStageConfig>) => {
    recruitmentSettingsService.createStage(data);
    refresh();
  }, [refresh]);

  const updateStage = useCallback((id: number, data: Partial<RecruitmentStageConfig>) => {
    recruitmentSettingsService.updateStage(id, data);
    refresh();
  }, [refresh]);

  const deleteStage = useCallback((id: number) => {
    recruitmentSettingsService.deleteStage(id);
    refresh();
  }, [refresh]);

  const seedDefaults = useCallback(() => {
    recruitmentSettingsService.seedDefaults();
    refresh();
  }, [refresh]);

  return { stages, createStage, updateStage, deleteStage, seedDefaults, refresh };
}
