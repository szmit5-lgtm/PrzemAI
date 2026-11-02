"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStagingReadiness } = require("../lib/stagingAgentReadiness");

const agent = (status, enabled = true) => ({
  type: "FINANCIAL",
  enabled,
  status,
  _count: { _all: 1 }
});

test("RUNNING agent alone cannot authorize staging smoke-test writes", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [agent("RUNNING")],
    runs: [],
    databaseIsolationVerified: true
  });
  assert.equal(report.readyForScheduledTests, false);
  assert.equal(report.safeToRunStagingWrites, false);
  assert.deepEqual(report.blockers, ["SUPPORTED_AGENT_RUNNING"]);
});

test("an IDLE supported agent remains available while another is RUNNING", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [agent("RUNNING"), agent("IDLE")],
    runs: [],
    databaseIsolationVerified: true
  });
  assert.equal(report.readyForScheduledTests, true);
  assert.equal(report.safeToRunStagingWrites, true);
  assert.deepEqual(report.blockers, []);
});

test("a disabled IDLE agent does not make a RUNNING agent available", () => {
  const report = buildStagingReadiness({
    users: 1,
    agents: [agent("RUNNING"), agent("IDLE", false)],
    runs: [],
    databaseIsolationVerified: true
  });
  assert.equal(report.readyForScheduledTests, false);
  assert.equal(report.safeToRunStagingWrites, false);
  assert.deepEqual(report.blockers, ["SUPPORTED_AGENT_RUNNING"]);
});

test("without supported agents the original blocker remains unchanged", () => {
  const report = buildStagingReadiness({ users: 1, agents: [], runs: [] });
  assert.equal(report.readyForScheduledTests, false);
  assert.equal(report.safeToRunStagingWrites, false);
  assert.deepEqual(report.blockers, [
    "NO_ENABLED_SUPPORTED_AGENT",
    "DATABASE_ISOLATION_UNVERIFIED"
  ]);
});
