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

  // Stage actions (Slice B) — advance / reject / resubmit are live.
  const advanceStage = useCallback(async (id: number) => {
    await recruitmentService.advanceStage(id);
    await reload();
  }, [reload]);

  const rejectApplicant = useCallback(async (id: number, reason: string) => {
    await recruitmentService.rejectApplicant(id, reason);
    await reload();
  }, [reload]);

  const resubmitApplicant = useCallback(async (id: number) => {
    await recruitmentService.resubmitApplicant(id);
    await reload();
  }, [reload]);

  // approve → courier promotion is Slice C — still a no-op stub.
  const approveApplicant = useCallback((id: number) => {
    recruitmentService.approveApplicant(id);
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
