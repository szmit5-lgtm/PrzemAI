"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/agentDashboardPayload.js"),
    "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

test("dashboard rejects malformed agent records before counting enabled agents", async () => {
  const { parseAgentDashboardResponses, getAgentDashboardSummary } = await loadParser();
  for (const invalid of [null, "agent", 42, false, []]) {
    assert.throws(
      () => parseAgentDashboardResponses({ data: [{ id: "valid" }, invalid] }, { data: [] }),
      /Nieprawidłowy format danych agentów lub integracji/
    );
  }
  const parsed = parseAgentDashboardResponses(
    { data: [{ id: "agent-1", enabled: true }] },
    { data: [] }
  );
  assert.equal(getAgentDashboardSummary(parsed.agents, parsed.integrations).enabledAgentCount, 1);
});

test("dashboard rejects malformed integration records before rendering them", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  for (const invalid of [null, "gmail", 42, false, []]) {
    assert.throws(
      () => parseAgentDashboardResponses({ data: [] }, { data: [{ id: "valid" }, invalid] }),
      /Nieprawidłowy format danych agentów lub integracji/
    );
  }
  assert.deepEqual(
    parseAgentDashboardResponses({ data: [] }, { data: [{ id: "gmail", enabled: false }] }),
    { agents: [], integrations: [{ id: "gmail", enabled: false }] }
  );
});


test("dashboard rejects ambiguous identities and non-boolean enabled flags", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  for (const invalid of [
    { id: "agent-1", enabled: "false" },
    { id: "agent-1", enabled: 1 },
    { id: "agent-1", enabled: null },
    { id: "agent-1" },
    { id: " ", enabled: false },
    { id: 42, enabled: true }
  ]) {
    assert.throws(
      () => parseAgentDashboardResponses({ data: [invalid] }, { data: [] }),
      /Nieprawidłowy format danych agentów lub integracji/
    );
    assert.throws(
      () => parseAgentDashboardResponses({ data: [] }, { data: [invalid] }),
      /Nieprawidłowy format danych agentów lub integracji/
    );
  }
});

test("dashboard rejects duplicate agent IDs and duplicate integration IDs", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  const firstAgent = { id: "agent-1", enabled: true };
  const secondAgent = { id: "agent-1", enabled: false };
  const firstIntegration = { id: "integration-1", enabled: true };
  const secondIntegration = { id: "integration-1", enabled: false };
  assert.throws(
    () => parseAgentDashboardResponses({ data: [firstAgent, secondAgent] }, { data: [] }),
    /Nieprawidłowy format danych agentów lub integracji/
  );
  assert.throws(
    () => parseAgentDashboardResponses({ data: [] }, { data: [firstIntegration, secondIntegration] }),
    /Nieprawidłowy format danych agentów lub integracji/
  );
  const agents = [firstAgent, { id: "agent-2", enabled: false }];
  const integrations = [firstIntegration, { id: "integration-2", enabled: false }];
  assert.deepEqual(
    parseAgentDashboardResponses({ data: agents }, { data: integrations }),
    { agents, integrations }
  );
});

// A planned, idle or unknown agent is not proof of a successful execution.
test("agent status styling reserves green for explicitly successful runs", async () => {
  const { getAgentStatusClass } = await loadParser();
  for (const status of ["IDLE", "PLANNED", "DISABLED", "UNKNOWN", null, undefined]) {
    assert.match(getAgentStatusClass(status), /text-slate-300/);
  }
  assert.match(getAgentStatusClass("SUCCESS"), /text-emerald-200/);
  assert.match(getAgentStatusClass("RUNNING"), /text-cyan-200/);
  for (const status of ["ERROR", "FAILED"]) {
    assert.match(getAgentStatusClass(status), /text-rose-200/);
  }
  const pageSource = await fs.readFile(
    path.join(__dirname, "../frontend/src/app/agents/page.js"), "utf8"
  );
  assert.match(pageSource, /getAgentStatusClass\(agent\.status\)/);
  assert.doesNotMatch(pageSource, /function statusClass\(/);
});
