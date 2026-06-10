import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  agentComplianceApi,
  type AgentComplianceDashboard,
  type AgentComplianceRosterItem,
  type AgentComplianceDetail,
} from '@/services/np_agentComplianceService';

// Live hooks for Agent/NP business-document compliance (Phase 1). Sibling to
// useCompliance (driver side). NP-scoped server-side; admin/tenant see all,
// an NP sees only its own record.

export function useAgentComplianceDashboard() {
  const [data, setData] = useState<AgentComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await agentComplianceApi.getDashboard());
    } catch (err: any) {
      setError(err.message || 'Failed to load agent compliance dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

export function useAgentComplianceRoster() {
  const [roster, setRoster] = useState<AgentComplianceRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoster(await agentComplianceApi.getRoster());
    } catch (err: any) {
      setError(err.message || 'Failed to load agent compliance roster');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Lookup by agentId so callers can join to the live identity roster (useAgents).
  const byId = useMemo(() => {
    const map = new Map<number, AgentComplianceRosterItem>();
    roster.forEach((item) => map.set(item.agentId, item));
    return map;
  }, [roster]);

  return { roster, byId, loading, error, refresh };
}

export function useAgentComplianceDetail(agentId: number | null | undefined) {
  const [detail, setDetail] = useState<AgentComplianceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await agentComplianceApi.getDetail(agentId));
    } catch (err: any) {
      setError(err.message || 'Failed to load agent compliance detail');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { detail, loading, error, refresh };
}
