"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStagingReadiness } = require("../lib/stagingAgentReadiness");

const enabledFinancial = { type: "FINANCIAL", status: "IDLE", enabled: true, _count: { _all: 1 } };

test("a historical successful run cannot compensate for zero staging users", () => {
  const report = buildStagingReadiness({
    users: 0, agents: [enabledFinancial], runs: [{ status: "SUCCESS", _count: { _all: 1 } }],
    successfulSupportedRuns: 1, databaseIsolationVerified: true
  });
  assert.equal(report.hasSuccessfulAgentRun, true);
  assert.equal(report.readyForScheduledTests, false);
  assert.equal(report.safeToRunStagingWrites, false);
  assert.deepEqual(report.blockers, ["NO_STAGING_USERS"]);
});

test("enabled unsupported agents do not qualify staging for scheduled smoke tests", () => {
  const report = buildStagingReadiness({
    users: 1, agents: [{ type: "MAIL", status: "IDLE", enabled: true, _count: { _all: 2 } }],
    runs: [], databaseIsolationVerified: true
  });
  assert.equal(report.readyForScheduledTests, false);
  assert.equal(report.safeToRunStagingWrites, false);
  assert.deepEqual(report.blockers, ["NO_ENABLED_SUPPORTED_AGENT"]);
  assert.equal(report.agentCounts[0].runtimeSupported, false);
});

test("isolation must be literal boolean true, never a truthy environment string", () => {
  for (const value of ["true", "1", 1, null, undefined]) {
    const report = buildStagingReadiness({
      users: 1, agents: [enabledFinancial], runs: [], databaseIsolationVerified: value
    });
    assert.equal(report.readyForScheduledTests, true);
    assert.equal(report.safeToRunStagingWrites, false);
    assert.deepEqual(report.blockers, ["DATABASE_ISOLATION_UNVERIFIED"]);
  }
});
