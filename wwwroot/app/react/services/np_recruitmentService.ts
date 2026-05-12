// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
import { mockApplicants, mockPipelineSummary } from './np_devData';
import type { CourierApplicant, ApplicantFilter, PipelineSummary } from '@/types';

export const recruitmentService = {
  getApplicants(filters?: ApplicantFilter): CourierApplicant[] {
    let list = mockApplicants;
    if (filters?.stage) list = list.filter(a => a.pipelineStage === filters.stage);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a => `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q));
    }
    return list;
  },

  getApplicantById(id: number): CourierApplicant | undefined {
    return mockApplicants.find(a => a.id === id);
  },

  getPipelineSummary(): PipelineSummary[] {
    return mockPipelineSummary;
  },

  createApplicant(_data: Partial<CourierApplicant>): CourierApplicant {
    throw new Error('createApplicant() not yet wired to backend');
  },

  updateApplicant(_id: number, _updates: Partial<CourierApplicant>): CourierApplicant | undefined {
    return undefined;
  },

  advanceStage(_id: number): CourierApplicant | undefined {
    return undefined;
  },

  rejectApplicant(_id: number, _reason: string): CourierApplicant | undefined {
    return undefined;
  },

  approveApplicant(_id: number): CourierApplicant | undefined {
    return undefined;
  },

  resubmitApplicant(_id: number): CourierApplicant | undefined {
    return undefined;
  },

  promoteToDriver(_id: number): CourierApplicant | undefined {
    return undefined;
  },

  deleteApplicant(_id: number): boolean {
    return false;
  },
};
