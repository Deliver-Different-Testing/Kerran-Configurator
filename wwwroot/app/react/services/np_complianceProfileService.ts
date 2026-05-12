// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
import { mockComplianceProfiles, mockDriverComplianceStatuses } from './np_devData';
import type { ComplianceProfile, DriverComplianceStatus } from '@/types';

export interface RecruitmentConfig {
  recruitmentViewMode: 'full_pipeline' | 'ready_for_review';
  visibleStages?: string[];
}

let recruitmentConfig: RecruitmentConfig = { recruitmentViewMode: 'full_pipeline' };

export const complianceProfileService = {
  getAll(): ComplianceProfile[] {
    return mockComplianceProfiles;
  },

  getById(id: number): ComplianceProfile | undefined {
    return mockComplianceProfiles.find(p => p.id === id);
  },

  create(_profile: Omit<ComplianceProfile, 'id' | 'createdDate'>): ComplianceProfile {
    throw new Error('create() not yet wired to backend');
  },

  update(_id: number, _updates: Partial<ComplianceProfile>): ComplianceProfile | undefined {
    return undefined;
  },

  delete(_id: number): boolean {
    return false;
  },

  getDriverStatuses(): DriverComplianceStatus[] {
    return mockDriverComplianceStatuses;
  },

  getDriverStatus(courierId: number): DriverComplianceStatus | undefined {
    return mockDriverComplianceStatuses.find(s => s.courierId === courierId);
  },

  getEligibleDriverCount(profileId: number): number {
    return mockDriverComplianceStatuses.filter(s => s.complianceProfileId === profileId).length;
  },

  getRecruitmentConfig(): RecruitmentConfig {
    return recruitmentConfig;
  },

  setRecruitmentConfig(config: RecruitmentConfig): void {
    recruitmentConfig = config;
  },
};
