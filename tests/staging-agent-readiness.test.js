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
