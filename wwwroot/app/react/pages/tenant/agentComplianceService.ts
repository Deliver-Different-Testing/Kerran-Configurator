import { useSyncExternalStore } from 'react';
import type { AgentStatus, BusinessComplianceDocument, TenantCourier } from '@/types';
import { NP_DOC_REQUIREMENTS, mockAgentDrivers, mockAgents, type ExtAgent } from './agentData';

// Agent compliance/driver mock store (NP-lane agent workspace). The onboarding
// pipeline that used to live here has moved to the real API
// (services/tenant_agentOnboardingService.ts + /api/v1/tenant/agents/onboarding);
// this store now covers only the still-mock agent + compliance surfaces.

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
}

let state: AgentComplianceState = {
  agents: mockAgents.map(normalizeAgent),
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

export function useAgents() {
  return useSyncExternalStore(subscribe, () => getSnapshot().agents);
}

export function useAgent(agentId: number | null | undefined) {
  return useSyncExternalStore(subscribe, () => getSnapshot().agents.find((agent) => agent.id === agentId));
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
