// Reject malformed API payloads instead of presenting an empty agent dashboard.
// A valid account may genuinely have no agents or integrations: [] is accepted.
export function parseAgentDashboardResponses(agentsResponse, integrationsResponse) {
  const agents = agentsResponse?.data;
  const integrations = integrationsResponse?.data;

  if (!Array.isArray(agents) || !Array.isArray(integrations)) {
    throw new Error("Nieprawidłowy format danych agentów lub integracji.");
  }

  return { agents, integrations };
}
