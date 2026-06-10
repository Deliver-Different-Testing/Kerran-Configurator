// Live — backed by /api/v1/np/compliance/agents/* + /compliance/onboarding/summary
// (Phase 1, Agent/NP business-document compliance). Paths are relative to the
// np_api axios baseURL (/api/v1/np). Sibling to np_complianceService (the
// courier/driver side). Computed server-side against the NP DocumentTypes +
// tucAgentDocument, NP-scoped via INpScopeResolver, with onboarding carry-through.
import api from './np_api';

export type AgentDocStatus = 'missing' | 'under_review' | 'approved' | 'rejected';
export type AgentDocSource = 'directory' | 'upload' | 'onboarding';
export type AgentRiskLevel = 'High' | 'Medium' | 'Low';

export interface AgentBusinessComplianceSummary {
  totalDocuments: number;
  approvedDocuments: number;
  mandatoryDocuments: number;
  approvedMandatoryDocuments: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  missingDocuments: number;
}

export interface AgentDocRequirementStatus {
  documentTypeId: number;
  documentTypeName: string;
  category: string;
  mandatory: boolean;
  status: AgentDocStatus;
  source: AgentDocSource;
  documentId?: number | null;
  expiryDate?: string | null;
  daysUntilExpiry?: number | null;
  isExpiring: boolean;
  isExpired: boolean;
}

export interface AgentComplianceDetail {
  agentId: number;
  compliancePercent: number;
  summary: AgentBusinessComplianceSummary;
  requirements: AgentDocRequirementStatus[];
}

export interface AgentComplianceRosterItem {
  agentId: number;
  compliancePercent: number;
  riskLevel: AgentRiskLevel;
  summary: AgentBusinessComplianceSummary;
}

export interface AgentComplianceDashboard {
  totalAgents: number;
  compliantAgents: number;
  highRiskAgents: number;
  agentsWithExpiring: number;
  agentsWithMissingMandatory: number;
  totalMissingMandatoryDocs: number;
  totalExpiringDocs: number;
  averageCompliancePercent: number;
}

export interface AgentOnboardingComplianceSummary {
  carriedThroughItems: number;
  agentsWithCarriedDocs: number;
}

export const agentComplianceApi = {
  async getDashboard(): Promise<AgentComplianceDashboard> {
    const { data } = await api.get<AgentComplianceDashboard>('/compliance/agents/dashboard');
    return data;
  },

  async getRoster(): Promise<AgentComplianceRosterItem[]> {
    const { data } = await api.get<AgentComplianceRosterItem[]>('/compliance/agents/roster');
    return data;
  },

  async getDetail(agentId: number): Promise<AgentComplianceDetail> {
    const { data } = await api.get<AgentComplianceDetail>(`/compliance/agents/${agentId}`);
    return data;
  },

  async getOnboardingSummary(): Promise<AgentOnboardingComplianceSummary> {
    const { data } = await api.get<AgentOnboardingComplianceSummary>('/compliance/onboarding/summary');
    return data;
  },
};
