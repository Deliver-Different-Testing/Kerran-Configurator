import { useState, useEffect, useCallback } from 'react';
import { recruitmentService } from '@/services/np_recruitmentService';
import type { ApplicantFilter, CourierApplicant, PipelineSummary } from '@/types';

export function useRecruitment() {
  const [filters, setFilters] = useState<ApplicantFilter>({});
  const [applicants, setApplicants] = useState<CourierApplicant[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary[]>([]);

  const reload = useCallback(async () => {
    const [a, s] = await Promise.all([
      recruitmentService.getApplicants(filters),
      recruitmentService.getPipelineSummary(),
    ]);
    setApplicants(a);
    setPipelineSummary(s);
  }, [filters]);

  useEffect(() => { void reload(); }, [reload]);

  // Mutating actions are not wired yet (Slice B/C) — the service methods are
  // no-ops; the wrappers stay so the pipeline page's hook contract is stable.
  const advanceStage = useCallback((id: number) => {
    recruitmentService.advanceStage(id);
    void reload();
  }, [reload]);

  const rejectApplicant = useCallback((id: number, reason: string) => {
    recruitmentService.rejectApplicant(id, reason);
    void reload();
  }, [reload]);

  const approveApplicant = useCallback((id: number) => {
    recruitmentService.approveApplicant(id);
    void reload();
  }, [reload]);

  const resubmitApplicant = useCallback((id: number) => {
    recruitmentService.resubmitApplicant(id);
    void reload();
  }, [reload]);

  return {
    applicants,
    pipelineSummary,
    filters,
    setFilters,
    advanceStage,
    rejectApplicant,
    approveApplicant,
    resubmitApplicant,
    refresh: reload,
  };
}

export function useApplicant(id: number) {
  const [applicant, setApplicant] = useState<CourierApplicant | undefined>(undefined);

  const reload = useCallback(async () => {
    setApplicant(await recruitmentService.getApplicantById(id));
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  return { applicant, refresh: reload };
}
