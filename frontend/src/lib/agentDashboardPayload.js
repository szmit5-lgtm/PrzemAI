// Reject malformed API payloads instead of presenting an empty agent dashboard.
// A valid account may genuinely have no agents or integrations: [] is accepted.
export function parseAgentDashboardResponses(agentsResponse, integrationsResponse) {
  const agents = agentsResponse?.data;
  const integrations = integrationsResponse?.data;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

  // Arrays containing null, primitives or nested arrays can crash the dashboard
  // when it reads agent.enabled or renders integration fields.
  if (!Array.isArray(agents) || !Array.isArray(integrations) ||
      !agents.every(isRecord) || !integrations.every(isRecord)) {
    throw new Error("Nieprawidłowy format danych agentów lub integracji.");
  }

  return { agents, integrations };
}

// Unknown counts are different from a verified empty account.
export function getAgentDashboardSummary(agents, integrations, { loading = false, error = "" } = {}) {
  if (loading || error) {
    return {
      agentCount: null,
      enabledAgentCount: null,
      enabledIntegrationCount: null,
      showEmptyAgents: false,
      showEmptyIntegrations: false
    };
  }

  return {
    agentCount: agents.length,
    enabledAgentCount: agents.filter(agent => agent.enabled).length,
    enabledIntegrationCount: integrations.filter(integration => integration.enabled).length,
    showEmptyAgents: agents.length === 0,
    showEmptyIntegrations: integrations.length === 0
  };
}
