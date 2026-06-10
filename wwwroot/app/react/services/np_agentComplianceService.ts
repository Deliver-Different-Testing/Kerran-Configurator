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
  compliancePercent: number;          // business-doc completeness % (25% weight)
  courierCompliancePercent: number;   // courier roll-up % (75% weight)
  overallScorePercent: number;        // blended 25/75 NP score
  summary: AgentBusinessComplianceSummary;
  requirements: AgentDocRequirementStatus[];
}

export interface AgentComplianceRosterItem {
  agentId: number;
  compliancePercent: number;
  courierCompliancePercent: number;
  overallScorePercent: number;
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

// A single uploaded agent business-document instance (read shape — AgentDocumentDto).
export interface AgentDocument {
  id: number;
  agentId: number;
  documentTypeId: number;
  documentTypeName: string;
  fileName: string;
  contentType: string;
  length: number;
  uploadedDate: string;
  uploadedBy: string;
  verifyStatus: 'Pending' | 'Verified' | 'Rejected';
  verifiedDate: string | null;
  verifiedBy: string;
  rejectReason: string;
  expiryDate: string | null;
  aiSuggestedDecision?: string | null;
  aiSuggestedExpiry?: string | null;
  aiRationale?: string | null;
  isActive: boolean;
}

// NP self-service (Phase 2) — the caller's OWN documents, agent resolved from
// scope server-side (no agentId in the URL). Backed by /api/v1/np/my-documents.
export const myAgentDocsApi = {
  async getCompliance(): Promise<AgentComplianceDetail> {
    const { data } = await api.get<AgentComplianceDetail>('/my-documents/compliance');
    return data;
  },

  async list(): Promise<AgentDocument[]> {
    const { data } = await api.get<AgentDocument[]>('/my-documents');
    return data;
  },

  async upload(documentTypeId: number, file: File, expiryDate?: string | null): Promise<AgentDocument> {
    const form = new FormData();
    form.append('File', file);
    form.append('DocumentTypeId', String(documentTypeId));
    if (expiryDate) form.append('ExpiryDate', expiryDate);
    const { data } = await api.post<AgentDocument>('/my-documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Proxy-download URL — browser streams via cookie auth, API streams from S3.
  downloadUrl(id: number): string {
    return `/api/v1/np/my-documents/${id}/download`;
  },
};

// Tenant-staff / DF-admin document review (Phase 1 controller +
// Phase 3a AI suggestion). agentId is in the URL; staff can verify/reject.
// Backed by /api/v1/np/agents/{agentId}/documents.
export const staffAgentDocsApi = {
  async list(agentId: number): Promise<AgentDocument[]> {
    const { data } = await api.get<AgentDocument[]>(`/agents/${agentId}/documents`);
    return data;
  },

  async verify(agentId: number, id: number): Promise<AgentDocument> {
    const { data } = await api.put<AgentDocument>(`/agents/${agentId}/documents/${id}/verify`);
    return data;
  },

  async reject(agentId: number, id: number, reason: string): Promise<AgentDocument> {
    const { data } = await api.put<AgentDocument>(`/agents/${agentId}/documents/${id}/reject`, { reason });
    return data;
  },

  downloadUrl(agentId: number, id: number): string {
    return `/api/v1/np/agents/${agentId}/documents/${id}/download`;
  },
};

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
