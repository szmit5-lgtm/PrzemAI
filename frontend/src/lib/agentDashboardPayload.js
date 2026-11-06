// Reject malformed API payloads instead of presenting an empty agent dashboard.
// A valid account may genuinely have no agents or integrations: [] is accepted.
export function parseAgentDashboardResponses(agentsResponse, integrationsResponse) {
  const agents = agentsResponse?.data;
  const integrations = integrationsResponse?.data;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  // The UI uses IDs for actions and enabled as a boolean. A string like
  // "false" is truthy and would incorrectly show an active agent/integration.
  const isValidRecord = value => isRecord(value) &&
    typeof value.id === "string" && value.id.trim().length > 0 &&
    typeof value.enabled === "boolean";
  // The dashboard reads runs[0].status when showing the last execution.
  // Reject malformed nested records rather than crashing the entire page.
  const isValidAgentRecord = value => isValidRecord(value) &&
    (value.runs === undefined || (Array.isArray(value.runs) &&
      value.runs.every(run => isRecord(run) &&
        typeof run.status === "string" && run.status.trim().length > 0)));

  // Arrays containing null, primitives or nested arrays can crash the dashboard
  // when it reads agent.enabled or renders integration fields.
  // Duplicate IDs make React reuse rows and leave toggle/run actions ambiguous.
  // Check each collection independently: agent and integration IDs may overlap.
  // Explicit API failures must never be presented as verified agent state.
  if ((agentsResponse?.success !== undefined && agentsResponse.success !== true) ||
      (integrationsResponse?.success !== undefined && integrationsResponse.success !== true) ||
      !Array.isArray(agents) || !Array.isArray(integrations) ||
      !agents.every(isValidAgentRecord) || !integrations.every(isValidRecord) ||
      new Set(agents.map(agent => agent.id)).size !== agents.length ||
      new Set(integrations.map(integration => integration.id)).size !== integrations.length) {
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


// A 2xx response is not enough to confirm that an agent or integration
// was toggled. Require the backend's acknowledged state and identity.
export function parseAgentToggleResponse(response, { id, enabled } = {}) {
  const record = response?.data;
  const valid = response?.success === true &&
    record !== null && typeof record === "object" && !Array.isArray(record) &&
    typeof record.id === "string" && record.id.trim().length > 0 &&
    typeof record.enabled === "boolean" &&
    (id === undefined || record.id === id) &&
    (enabled === undefined || record.enabled === enabled);

  if (!valid) {
    throw new Error("Nieprawidłowe potwierdzenie zmiany ustawień agenta lub integracji.");
  }
  return record;
}

// A manual run is synchronous in the current API. HTTP 200 alone does not
// prove the runner completed: require its explicit result summary.
export function parseAgentRunResponse(response) {
  const result = response?.data;
  if (response?.success !== true ||
      result === null || typeof result !== "object" || Array.isArray(result) ||
      typeof result.summary !== "string" || !result.summary.trim()) {
    throw new Error("Brak potwierdzenia zakończenia pracy agenta.");
  }
  return result;
}

// The runner supports Financial plus nine text-only business assignment processors.
// An external connector is never implied by an agent being enabled.
// Fail closed on missing or unrecognized states; only idle and failed agents
// can be safely offered a new manual execution.
export function canRunAgent(agent) {
  return (agent?.type === "FINANCIAL" || (
    ["SALES","OFFER","TASK","MAIL","DOCUMENT","MEETING","CONSTRUCTION","COMMUNICATION","EXECUTIVE"].includes(agent?.type) &&
    agent.mode === "TASK_DRAFT"
  )) &&
    agent.enabled === true &&
    (agent.status === "IDLE" || agent.status === "ERROR");
}

// Unknown or idle states must not be styled as successful executions.
export function getAgentStatusClass(status) {
  if (status === "RUNNING") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  if (status === "ERROR" || status === "FAILED") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (status === "SUCCESS") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  return "border-slate-400/20 bg-slate-400/10 text-slate-300";
}
