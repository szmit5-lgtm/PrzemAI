"use strict";

const SUPPORTED_RUNTIME_TYPES = Object.freeze(["FINANCIAL"]);

function buildStagingReadiness({ users, agents, runs }) {
  const agentCounts = agents.map(({ type, status, enabled, _count }) => ({
    type,
    status,
    enabled,
    count: _count._all,
    runtimeSupported: SUPPORTED_RUNTIME_TYPES.includes(type)
  }));
  const runCounts = runs.map(({ status, _count }) => ({
    status,
    count: _count._all
  }));

  return {
    environment: "staging",
    users,
    supportedRuntimeTypes: [...SUPPORTED_RUNTIME_TYPES],
    agentCounts,
    runCounts,
    readyForScheduledTests: users > 0 && agents.some(
      ({ type, enabled, _count }) =>
        SUPPORTED_RUNTIME_TYPES.includes(type) && enabled === true && _count._all > 0
    ),
    hasSuccessfulAgentRun: runCounts.some(({ status, count }) =>
      status === "SUCCESS" && count > 0
    )
  };
}

module.exports = { buildStagingReadiness };
