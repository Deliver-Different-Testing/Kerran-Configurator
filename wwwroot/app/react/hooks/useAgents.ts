import { useState, useEffect, useCallback } from 'react';
import type { Agent } from '@/types';
import { agentService } from '@/services/tenant_agentService';

interface UseAgentsParams {
  search?: string;
  status?: string;
  association?: string;
  isNp?: boolean;
}

export function useAgents(params?: UseAgentsParams) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await agentService.list(params);
      setAgents(data);
      setError(null);
    } catch (err) {
      setError('Failed to load agents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [params?.search, params?.status, params?.association, params?.isNp]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, loading, error, refetch: fetchAgents };
}
