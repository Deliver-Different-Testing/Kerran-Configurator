import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AgentWorkspace } from '@/components/tenant/AgentWorkspace';
import { agentService } from '@/services/tenant_agentService';
import type { Agent } from '@/types';

// Partner-workspace detail page (/agents/:id). Sources the agent from the REAL
// tenant directory so the id handed to AgentWorkspace is a real ucagID — which
// the live compliance + document endpoints (/api/v1/np/compliance/agents/:id +
// /agents/:id/documents) require.
//
// There is no GET /api/v1/tenant/agents/:id endpoint (the controller exposes
// list/create/update only), so we resolve the agent from the list — which the
// directory already loads — rather than a by-id fetch.
export function AgentDetail() {
  const { id } = useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    const numId = id ? Number(id) : NaN;
    if (!id || Number.isNaN(numId)) { setLoading(false); setNotFound(true); return; }
    setLoading(true);
    agentService.list()
      .then((res) => {
        if (!active) return;
        const found = res.data.find((a) => a.id === numId) ?? null;
        setAgent(found);
        setNotFound(found === null);
        setLoading(false);
      })
      .catch(() => { if (active) { setNotFound(true); setLoading(false); } });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading partner…</div>;
  if (notFound || !agent) return <Navigate to="/agents" replace />;

  return <AgentWorkspace agent={{ ...agent, npDocs: agent.npDocs ?? [] }} variant="page" />;
}
