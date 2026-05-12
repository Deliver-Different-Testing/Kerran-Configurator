import { useState, useMemo, useCallback } from 'react';
import { recruitmentService } from '@/services/np_recruitmentService';
import type { ApplicantFilter } from '@/types';

export function useRecruitment() {
  const [filters, setFilters] = useState<ApplicantFilter>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const applicants = useMemo(
    () => recruitmentService.getApplicants(filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, refreshKey]
  );

  const pipelineSummary = useMemo(
    () => recruitmentService.getPipelineSummary(),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const advanceStage = useCallback((id: number) => {
    recruitmentService.advanceStage(id);
    refresh();
  }, [refresh]);

  const rejectApplicant = useCallback((id: number, reason: string) => {
    recruitmentService.rejectApplicant(id, reason);
    refresh();
  }, [refresh]);

  const approveApplicant = useCallback((id: number) => {
    recruitmentService.approveApplicant(id);
    refresh();
  }, [refresh]);

  const resubmitApplicant = useCallback((id: number) => {
    recruitmentService.resubmitApplicant(id);
    refresh();
  }, [refresh]);

  return {
    applicants,
    pipelineSummary,
    filters,
    setFilters,
    advanceStage,
    rejectApplicant,
    approveApplicant,
    resubmitApplicant,
    refresh,
  };
}

export function useApplicant(id: number) {
  const [refreshKey, setRefreshKey] = useState(0);
  const applicant = useMemo(
    () => recruitmentService.getApplicantById(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, refreshKey]
  );
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);
  return { applicant, refresh };
}
