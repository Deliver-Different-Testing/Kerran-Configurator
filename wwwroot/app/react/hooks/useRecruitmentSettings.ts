import { useState, useEffect, useCallback } from 'react';
import { recruitmentSettingsService } from '@/services/np_recruitmentSettingsService';
import type { RecruitmentStageConfig } from '@/types';

export function useRecruitmentSettings() {
  const [stages, setStages] = useState<RecruitmentStageConfig[]>([]);

  const reload = useCallback(async () => {
    setStages(await recruitmentSettingsService.getStages());
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const createStage = useCallback(async (data: Partial<RecruitmentStageConfig>) => {
    await recruitmentSettingsService.createStage(data);
    await reload();
  }, [reload]);

  // The page issues partial edits (just `enabled`, just `mandatory`, …); the
  // backend PUT replaces the whole row, so merge onto the current stage first.
  const updateStage = useCallback(async (id: number, data: Partial<RecruitmentStageConfig>) => {
    const existing = stages.find(s => s.id === id);
    await recruitmentSettingsService.updateStage(id, { ...existing, ...data });
    await reload();
  }, [stages, reload]);

  const deleteStage = useCallback(async (id: number) => {
    await recruitmentSettingsService.deleteStage(id);
    await reload();
  }, [reload]);

  const seedDefaults = useCallback(async () => {
    setStages(await recruitmentSettingsService.seedDefaults());
  }, []);

  return { stages, createStage, updateStage, deleteStage, seedDefaults, refresh: reload };
}
