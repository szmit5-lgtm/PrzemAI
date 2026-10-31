"use strict";

const SUPPORTED_RUNTIME_TYPES = Object.freeze(["FINANCIAL"]);

function buildStagingReadiness({ users, agents, runs, successfulSupportedRuns = 0, databaseIsolationVerified = false }) {
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

  const hasEnabledSupportedAgent = agents.some(
    ({ type, enabled, _count }) =>
      SUPPORTED_RUNTIME_TYPES.includes(type) && enabled === true && _count._all > 0
  );
  const readyForScheduledTests = users > 0 && hasEnabledSupportedAgent;

  // Machine-readable blockers explain why a staging smoke test is unsafe.
  // Keep these separate from historical run success: a successful old run
  // does not prove that the current environment can execute new tasks.
  const blockers = [];
  if (users <= 0) blockers.push("NO_STAGING_USERS");
  if (!hasEnabledSupportedAgent) blockers.push("NO_ENABLED_SUPPORTED_AGENT");
  if (databaseIsolationVerified !== true) blockers.push("DATABASE_ISOLATION_UNVERIFIED");

  return {
    environment: "staging",
    users,
    supportedRuntimeTypes: [...SUPPORTED_RUNTIME_TYPES],
    agentCounts,
    runCounts,
    readyForScheduledTests,
    blockers,
    // A configured agent is not permission to write to an unverified database.
    safeToRunStagingWrites: databaseIsolationVerified === true && readyForScheduledTests,
    hasSuccessfulAgentRun: Number.isSafeInteger(successfulSupportedRuns) && successfulSupportedRuns > 0
  };
}

module.exports = { buildStagingReadiness, SUPPORTED_RUNTIME_TYPES };
