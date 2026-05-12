import { Navigate, useParams } from 'react-router-dom';
import { AgentWorkspace } from '@/components/tenant/AgentWorkspace';
import { useAgent } from './agentComplianceService';

export function AgentDetail() {
  const { id } = useParams();
  const agent = useAgent(id ? Number(id) : null);

  if (!agent) {
    return <Navigate to="/agents" replace />;
  }

  return <AgentWorkspace agent={agent} variant="page" />;
}
