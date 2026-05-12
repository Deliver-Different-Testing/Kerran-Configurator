import { useSyncExternalStore } from 'react';
import type { AgentStatus, BusinessComplianceDocument, BusinessComplianceRequirement, NpTier, TenantCourier } from '@/types';
import { BUSINESS_ONBOARDING_SEED, BUSINESS_ONBOARDING_STAGES, type BusinessOnboardingRecord } from './agentOnboardingData';
import { NP_DOC_REQUIREMENTS, mockAgentDrivers, mockAgents, type ExtAgent } from './agentData';

export interface BusinessComplianceSummary {
  totalDocuments: number;
  approvedDocuments: number;
  mandatoryDocuments: number;
  approvedMandatoryDocuments: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  missingDocuments: number;
}

export interface DriverComplianceSummary {
  compliant: number;
  expiring: number;
  nonCompliant: number;
}

export interface AgentWorkspaceRecord extends ExtAgent {
  npDocs: BusinessComplianceDocument[];
}

interface AgentComplianceState {
  agents: AgentWorkspaceRecord[];
  onboardingRecords: BusinessOnboardingRecord[];
}

export interface CreateOnboardingInput {
  businessName: string;
  primaryContact: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  association: BusinessOnboardingRecord['association'];
  memberId: string;
  source: BusinessOnboardingRecord['source'];
  notes: string;
  networkPartnerStatus: Extract<BusinessOnboardingRecord['networkPartnerStatus'], 'Candidate' | 'Agent Only'>;
}

const TODAY = '2026-03-08';
const requirementKeyByLegacyId: Record<string, BusinessComplianceRequirement['key']> = {
  insurance: 'insurance',
  authority: 'operating_authority',
  msa: 'service_agreement',
  tax: 'tax_id',
};

let state: AgentComplianceState = {
  agents: mockAgents.map(normalizeAgent),
  onboardingRecords: BUSINESS_ONBOARDING_SEED.map((record) => ({ ...record })),
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getSnapshot() {
  return state;
}

function setState(updater: (current: AgentComplianceState) => AgentComplianceState) {
  state = updater(state);
  emitChange();
}

function normalizeAgent(agent: ExtAgent): AgentWorkspaceRecord {
  return {
    ...agent,
    npDocs: ensureComplianceDocuments(agent.npDocs),
  };
}

function ensureComplianceDocuments(documents?: BusinessComplianceDocument[]): BusinessComplianceDocument[] {
  return NP_DOC_REQUIREMENTS.map((requirement) => {
    const existing = documents?.find((document) => document.requirementId === requirement.id);
    return existing
      ? { ...existing }
      : { requirementId: requirement.id, status: 'missing', source: 'directory' };
  });
}

function convertOnboardingCompliance(record: BusinessOnboardingRecord): BusinessComplianceDocument[] {
  const onboardingDocs = record.complianceItems.flatMap((item) => {
    const requirementKey = requirementKeyByLegacyId[item.id];
    const requirement = NP_DOC_REQUIREMENTS.find((entry) => entry.key === requirementKey);
    if (!requirement) return [];

    const status: BusinessComplianceDocument['status'] = item.status === 'complete' ? 'approved' : item.status === 'in_progress' ? 'under_review' : 'missing';
    return [{
      requirementId: requirement.id,
      status,
      uploadedDate: item.updatedAt,
      reviewedDate: item.status === 'complete' ? item.updatedAt : undefined,
      source: 'onboarding' as const,
      notes: `${item.label} updated during onboarding.`,
    }];
  });

  const docMap = new Map<number, BusinessComplianceDocument>();
  ensureComplianceDocuments().forEach((document) => docMap.set(document.requirementId, document));
  onboardingDocs.forEach((document) => docMap.set(document.requirementId, document));

  return NP_DOC_REQUIREMENTS.map((requirement) => {
    const baseDocument = docMap.get(requirement.id)!;
    if (record.stage === 'Activated' || record.stage === 'Approved') {
      return {
        ...baseDocument,
        status: baseDocument.status === 'missing' && !requirement.mandatory ? 'uploaded' : baseDocument.status,
      };
    }
    return baseDocument;
  });
}

function mergeComplianceDocuments(
  directoryDocuments: BusinessComplianceDocument[],
  onboardingDocuments: BusinessComplianceDocument[],
  favorOnboarding: boolean,
): BusinessComplianceDocument[] {
  return NP_DOC_REQUIREMENTS.map((requirement) => {
    const directoryDoc = directoryDocuments.find((document) => document.requirementId === requirement.id);
    const onboardingDoc = onboardingDocuments.find((document) => document.requirementId === requirement.id);
    const preferred = favorOnboarding ? onboardingDoc || directoryDoc : directoryDoc || onboardingDoc;
    return preferred ? { ...preferred } : { requirementId: requirement.id, status: 'missing', source: 'directory' };
  });
}

function deriveAgentStatus(record: BusinessOnboardingRecord): AgentStatus {
  if (record.stage === 'Activated') return 'Active';
  if (record.stage === 'Approved' || record.stage === 'Review In Progress' || record.stage === 'Documents Received') return 'Pending NP';
  if (record.networkPartnerStatus === 'Agent Only') return 'Potential';
  return 'Potential';
}

function deriveAgentTier(record: BusinessOnboardingRecord): NpTier | null {
  if (record.networkPartnerStatus !== 'Approved NP') return null;
  return record.estimatedDrivers >= 40 ? 'Multi-Client' : 'Base';
}

function buildOrUpdateAgentFromOnboarding(record: BusinessOnboardingRecord, agents: AgentWorkspaceRecord[]): AgentWorkspaceRecord[] {
  const onboardingDocuments = convertOnboardingCompliance(record);
  const existingAgent = agents.find((agent) => agent.id === record.linkedAgentId)
    || agents.find((agent) => agent.name === record.businessName && agent.city === record.city && agent.state === record.state);

  if (existingAgent) {
    const updatedAgent: AgentWorkspaceRecord = {
      ...existingAgent,
      contactName: record.primaryContact,
      phone: record.phone,
      email: record.email,
      address: record.address,
      city: record.city,
      state: record.state,
      status: deriveAgentStatus(record),
      notes: record.notes,
      association: record.association,
      associationMemberId: record.memberId || '',
      isNetworkPartner: record.networkPartnerStatus === 'Approved NP',
      npTier: deriveAgentTier(record),
      npActivatedDate: record.stage === 'Activated' ? TODAY : existingAgent.npActivatedDate,
      coverageAreas: record.coverage,
      updatedDate: TODAY,
      onboardingRecordId: record.id,
      npDocs: mergeComplianceDocuments(existingAgent.npDocs, onboardingDocuments, true),
    };

    return agents.map((agent) => (agent.id === existingAgent.id ? updatedAgent : agent));
  }

  const nextId = Math.max(...agents.map((agent) => agent.id), 0) + 1;
  const newAgent: AgentWorkspaceRecord = {
    id: nextId,
    name: record.businessName,
    contactName: record.primaryContact,
    phone: record.phone,
    email: record.email,
    address: record.address,
    city: record.city,
    state: record.state,
    postCode: 'TBD',
    country: 'US',
    gps: null,
    status: deriveAgentStatus(record),
    ranking: 0,
    notes: record.notes,
    association: record.association,
    associationMemberId: record.memberId || '',
    isNetworkPartner: record.networkPartnerStatus === 'Approved NP',
    npTier: deriveAgentTier(record),
    npActivatedDate: record.stage === 'Activated' ? TODAY : null,
    coverageAreas: record.coverage,
    defaultCourierPayPercent: null,
    createdDate: record.createdAt,
    updatedDate: TODAY,
    onboardingRecordId: record.id,
    npDocs: ensureComplianceDocuments(onboardingDocuments),
  };

  return [...agents, newAgent];
}

function updateOnboardingRecord(recordId: number, updater: (record: BusinessOnboardingRecord) => BusinessOnboardingRecord) {
  setState((current) => {
    let updatedRecord: BusinessOnboardingRecord | undefined;

    const onboardingRecords = current.onboardingRecords.map((record) => {
      if (record.id !== recordId) return record;
      updatedRecord = updater(record);
      return updatedRecord;
    });

    if (!updatedRecord) {
      return current;
    }

    const resolvedRecord = updatedRecord;
    const agents = resolvedRecord.stage === 'Rejected / Archived'
      ? current.agents
      : buildOrUpdateAgentFromOnboarding(resolvedRecord, current.agents);

    const linkedAgent = agents.find((agent) => agent.onboardingRecordId === resolvedRecord.id);
    const normalizedRecord = linkedAgent && linkedAgent.id !== resolvedRecord.linkedAgentId
      ? { ...resolvedRecord, linkedAgentId: linkedAgent.id }
      : resolvedRecord;

    return {
      agents,
      onboardingRecords: onboardingRecords.map((record) => (record.id === normalizedRecord.id ? normalizedRecord : record)),
    };
  });
}

export function useAgents() {
  return useSyncExternalStore(subscribe, () => getSnapshot().agents);
}

export function useAgent(agentId: number | null | undefined) {
  return useSyncExternalStore(subscribe, () => getSnapshot().agents.find((agent) => agent.id === agentId));
}

export function useOnboardingRecords() {
  return useSyncExternalStore(subscribe, () => getSnapshot().onboardingRecords);
}

export function useOnboardingRecord(recordId: number | null | undefined) {
  return useSyncExternalStore(subscribe, () => getSnapshot().onboardingRecords.find((record) => record.id === recordId));
}

export function getDriversForAgent(agentId: number): TenantCourier[] {
  return mockAgentDrivers[agentId] || [];
}

export function getBusinessComplianceSummary(documents: BusinessComplianceDocument[]): BusinessComplianceSummary {
  const normalizedDocuments = ensureComplianceDocuments(documents);
  const mandatoryRequirements = NP_DOC_REQUIREMENTS.filter((requirement) => requirement.mandatory);

  return {
    totalDocuments: normalizedDocuments.length,
    approvedDocuments: normalizedDocuments.filter((document) => document.status === 'approved').length,
    mandatoryDocuments: mandatoryRequirements.length,
    approvedMandatoryDocuments: mandatoryRequirements.filter((requirement) => normalizedDocuments.find((document) => document.requirementId === requirement.id)?.status === 'approved').length,
    pendingDocuments: normalizedDocuments.filter((document) => document.status === 'uploaded' || document.status === 'under_review').length,
    rejectedDocuments: normalizedDocuments.filter((document) => document.status === 'rejected').length,
    missingDocuments: normalizedDocuments.filter((document) => document.status === 'missing').length,
  };
}

export function getDriverComplianceSummary(drivers: TenantCourier[]): DriverComplianceSummary {
  return {
    compliant: drivers.filter((driver) => driver.complianceStatus === 'Compliant').length,
    expiring: drivers.filter((driver) => driver.complianceStatus === 'Expiring').length,
    nonCompliant: drivers.filter((driver) => driver.complianceStatus === 'Non-Compliant').length,
  };
}

export function getCompliancePercentage(documents: BusinessComplianceDocument[]) {
  const summary = getBusinessComplianceSummary(documents);
  return summary.mandatoryDocuments === 0
    ? 0
    : Math.round((summary.approvedMandatoryDocuments / summary.mandatoryDocuments) * 100);
}

export function advanceOnboardingStage(recordId: number) {
  updateOnboardingRecord(recordId, (record) => {
    const currentIndex = BUSINESS_ONBOARDING_STAGES.indexOf(record.stage);
    if (currentIndex === -1 || currentIndex >= BUSINESS_ONBOARDING_STAGES.length - 2) {
      return record;
    }

    const nextStage = BUSINESS_ONBOARDING_STAGES[currentIndex + 1];
    const shouldComplete = nextStage === 'Approved' || nextStage === 'Activated';

    return {
      ...record,
      stage: nextStage,
      networkPartnerStatus: shouldComplete && record.networkPartnerStatus !== 'Agent Only' ? 'Approved NP' : record.networkPartnerStatus,
      lastUpdated: TODAY,
      complianceComplete: shouldComplete || record.complianceComplete,
      complianceItems: shouldComplete
        ? record.complianceItems.map((item) => ({ ...item, status: 'complete', updatedAt: TODAY }))
        : record.complianceItems,
    };
  });
}

export function approveAndActivateOnboarding(recordId: number) {
  updateOnboardingRecord(recordId, (record) => ({
    ...record,
    stage: 'Activated',
    networkPartnerStatus: record.networkPartnerStatus === 'Agent Only' ? 'Agent Only' : 'Approved NP',
    complianceComplete: true,
    archived: false,
    lastUpdated: TODAY,
    complianceItems: record.complianceItems.map((item) => ({ ...item, status: 'complete', updatedAt: TODAY })),
  }));
}

export function archiveOnboardingRecord(recordId: number) {
  updateOnboardingRecord(recordId, (record) => ({
    ...record,
    stage: 'Rejected / Archived',
    archived: true,
    networkPartnerStatus: 'Archived',
    lastUpdated: TODAY,
  }));
}

export function archiveAgent(agentId: number, reason: string, notes: string) {
  setState((current) => ({
    ...current,
    agents: current.agents.map((agent) =>
      agent.id === agentId
        ? { ...agent, status: 'Archived' as const, notes: `[ARCHIVED ${new Date().toLocaleString()} — ${reason}] ${notes}`.trim() }
        : agent
    ),
  }));
}

export function createOnboardingRecord(input: CreateOnboardingInput) {
  const nextId = Math.max(...state.onboardingRecords.map((record) => record.id), 0) + 1;
  const nextRecord: BusinessOnboardingRecord = {
    id: nextId,
    businessName: input.businessName,
    primaryContact: input.primaryContact,
    phone: input.phone,
    email: input.email,
    address: 'Business address to be completed',
    city: input.city,
    state: input.state,
    coverage: [`${input.city}, ${input.state}`],
    association: input.association,
    memberId: input.memberId,
    source: input.source,
    stage: 'Prospect Identified',
    networkPartnerStatus: input.networkPartnerStatus,
    fleetProfile: 'Fleet profile pending qualification',
    estimatedDrivers: 0,
    serviceCapabilities: ['Pending qualification'],
    specialties: ['To be confirmed'],
    notes: input.notes || 'Created from manual business onboarding entry.',
    complianceItems: [
      { id: 'insurance', label: 'Insurance certificate', status: 'missing', updatedAt: TODAY },
      { id: 'authority', label: 'Operating authority / registration', status: 'missing', updatedAt: TODAY },
      { id: 'msa', label: 'Master services agreement', status: 'missing', updatedAt: TODAY },
      { id: 'tax', label: 'Tax verification', status: 'missing', updatedAt: TODAY },
    ],
    complianceComplete: false,
    reviewer: 'Unassigned',
    owner: 'Tenant Operations',
    lastUpdated: TODAY,
    createdAt: TODAY,
    archived: false,
  };

  setState((current) => ({
    ...current,
    onboardingRecords: [nextRecord, ...current.onboardingRecords],
  }));

  return nextId;
}

export function getAgentStatusTone(status: AgentStatus) {
  const styles: Record<AgentStatus, string> = {
    Active: 'bg-green-100 text-green-700',
    Inactive: 'bg-gray-100 text-gray-600',
    Pending: 'bg-amber-100 text-amber-700',
    Potential: 'bg-blue-100 text-blue-700',
    'Pending NP': 'bg-purple-100 text-purple-700',
    Suspended: 'bg-red-100 text-red-700',
    Archived: 'bg-slate-200 text-slate-500',
  };

  return styles[status];
}

export { NP_DOC_REQUIREMENTS };
