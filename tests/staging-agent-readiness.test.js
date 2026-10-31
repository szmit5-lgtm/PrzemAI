"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStagingReadiness } = require("../lib/stagingAgentReadiness");

const group = (type, enabled = true, status = "IDLE", count = 1) =>
  ({ type, enabled, status, _count: { _all: count } });
const run = (status, count = 1) => ({ status, _count: { _all: count } });

test("does not report staging ready when there are no users", () => {
  const report = buildStagingReadiness({ users: 0, agents: [group("FINANCIAL")], runs: [] });
  assert.equal(report.readyForScheduledTests, false);
  assert.equal(report.hasSuccessfulAgentRun, false);
});

test("does not count planned or disabled agents as ready", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [group("EXECUTIVE"), group("FINANCIAL", false)],
    runs: []
  });
  assert.equal(report.readyForScheduledTests, false);
  assert.equal(report.agentCounts[0].runtimeSupported, false);
  assert.equal(report.agentCounts[1].enabled, false);
});

test("enabled financial agent is testable but not yet verified as executed", () => {
  const report = buildStagingReadiness({ users: 1, agents: [group("FINANCIAL")], runs: [] });
  assert.equal(report.readyForScheduledTests, true);
  assert.equal(report.hasSuccessfulAgentRun, false);
});

test("successful run is reported separately from configuration readiness", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL")],
    runs: [run("SUCCESS", 2), run("FAILED")],
    successfulSupportedRuns: 2
  });
  assert.equal(report.hasSuccessfulAgentRun, true);
  assert.deepEqual(report.runCounts, [{ status: "SUCCESS", count: 2 }, { status: "FAILED", count: 1 }]);
});


test("unrelated successful runs do not falsely verify a supported agent", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL")],
    runs: [run("SUCCESS", 3)],
    successfulSupportedRuns: 0
  });
  assert.equal(report.readyForScheduledTests, true);
  assert.equal(report.hasSuccessfulAgentRun, false);
});

test("never authorizes staging writes without independently verified database isolation", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL")],
    runs: [run("SUCCESS")],
    successfulSupportedRuns: 1,
    databaseIsolationVerified: false
  });
  assert.equal(report.readyForScheduledTests, true);
  assert.equal(report.hasSuccessfulAgentRun, true);
  assert.equal(report.safeToRunStagingWrites, false);
});

test("authorizes staging writes only when isolation and executable agent are both verified", () => {
  const isolated = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL")],
    runs: [],
    databaseIsolationVerified: true
  });
  assert.equal(isolated.safeToRunStagingWrites, true);

  const noAgents = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL", false)],
    runs: [],
    databaseIsolationVerified: true
  });
  assert.equal(noAgents.safeToRunStagingWrites, false);
});

test("explains why empty staging cannot run agent smoke tests", () => {
  const report = buildStagingReadiness({ users: 0, agents: [], runs: [] });
  assert.deepEqual(report.blockers, [
    "NO_STAGING_USERS",
    "NO_ENABLED_SUPPORTED_AGENT",
    "DATABASE_ISOLATION_UNVERIFIED"
  ]);
  assert.equal(report.safeToRunStagingWrites, false);
});

test("reports isolation as the only blocker when a supported agent is configured", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL")],
    runs: [],
    databaseIsolationVerified: false
  });
  assert.deepEqual(report.blockers, ["DATABASE_ISOLATION_UNVERIFIED"]);
  assert.equal(report.readyForScheduledTests, true);
});

test("clears blockers only after independent isolation and supported-agent checks", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL")],
    runs: [],
    databaseIsolationVerified: true
  });
  assert.deepEqual(report.blockers, []);
  assert.equal(report.safeToRunStagingWrites, true);
});

test("truthy non-boolean isolation metadata cannot authorize staging writes", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL")],
    runs: [],
    databaseIsolationVerified: "true"
  });
  assert.equal(report.readyForScheduledTests, true);
  assert.equal(report.safeToRunStagingWrites, false);
  assert.deepEqual(report.blockers, ["DATABASE_ISOLATION_UNVERIFIED"]);
});

test("historical successes cannot authorize writes after the supported agent is disabled", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [group("FINANCIAL", false)],
    runs: [run("SUCCESS", 4)],
    successfulSupportedRuns: 4,
    databaseIsolationVerified: true
  });
  assert.equal(report.hasSuccessfulAgentRun, true);
  assert.equal(report.readyForScheduledTests, false);
  assert.equal(report.safeToRunStagingWrites, false);
  assert.deepEqual(report.blockers, ["NO_ENABLED_SUPPORTED_AGENT"]);
});
