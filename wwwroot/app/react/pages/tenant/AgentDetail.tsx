import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AgentWorkspace } from '@/components/tenant/AgentWorkspace';
import { agentService } from '@/services/tenant_agentService';
import type { Agent } from '@/types';

// Partner-workspace detail page (/agents/:id). Sources the agent from the REAL
// tenant directory (GET /api/v1/tenant/agents/:id) so the id passed to
// AgentWorkspace is a real ucagID — which the live compliance endpoints
// (/api/v1/np/compliance/agents/:id + /agents/:id/documents) require.
export function AgentDetail() {
  const { id } = useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) { setLoading(false); setNotFound(true); return; }
    setLoading(true);
    agentService.get(Number(id))
      .then((res) => { if (active) { setAgent(res.data); setLoading(false); } })
      .catch(() => { if (active) { setNotFound(true); setLoading(false); } });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading partner…</div>;
  if (notFound || !agent) return <Navigate to="/agents" replace />;

  return <AgentWorkspace agent={{ ...agent, npDocs: agent.npDocs ?? [] }} variant="page" />;
}
