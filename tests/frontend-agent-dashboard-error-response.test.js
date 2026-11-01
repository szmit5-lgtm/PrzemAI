"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/agentDashboardPayload.js"), "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

const agent = { id: "agent-1", enabled: true };
const integration = { id: "integration-1", enabled: true };

test("agent dashboard rejects explicitly unsuccessful agent list responses", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  for (const success of [false, null, 0, "true"]) {
    assert.throws(
      () => parseAgentDashboardResponses({ success, data: [agent] }, { data: [integration] }),
      /Nieprawidłowy format danych agentów lub integracji/
    );
  }
});

test("agent dashboard rejects explicitly unsuccessful integration list responses", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  for (const success of [false, null, 0, "true"]) {
    assert.throws(
      () => parseAgentDashboardResponses({ data: [agent] }, { success, data: [integration] }),
      /Nieprawidłowy format danych agentów lub integracji/
    );
  }
});

test("agent dashboard still accepts successful and legacy list responses", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  assert.deepEqual(
    parseAgentDashboardResponses({ success: true, data: [agent] }, { success: true, data: [integration] }),
    { agents: [agent], integrations: [integration] }
  );
  assert.deepEqual(
    parseAgentDashboardResponses({ data: [agent] }, { data: [integration] }),
    { agents: [agent], integrations: [integration] }
  );
});
