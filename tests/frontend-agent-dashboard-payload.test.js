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

test("agent dashboard accepts legitimate empty agent and integration lists", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  assert.deepEqual(
    parseAgentDashboardResponses({ success: true, data: [] }, { success: true, data: [] }),
    { agents: [], integrations: [] }
  );
});

test("agent dashboard preserves valid agent and integration records", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  const agents = [{ id: "agent-1", enabled: true }];
  const integrations = [{ id: "integration-1", enabled: false }];
  assert.deepEqual(
    parseAgentDashboardResponses({ data: agents }, { data: integrations }),
    { agents, integrations }
  );
});

test("agent dashboard rejects malformed agent data instead of showing zero agents", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  for (const response of [null, {}, { data: null }, { data: {} }, { data: "[]" }]) {
    assert.throws(
      () => parseAgentDashboardResponses(response, { data: [] }),
      /Nieprawidłowy format danych agentów lub integracji/
    );
  }
});

test("agent dashboard rejects malformed integration data instead of showing zero integrations", async () => {
  const { parseAgentDashboardResponses } = await loadParser();
  for (const response of [null, {}, { data: null }, { data: {} }, { data: "[]" }]) {
    assert.throws(
      () => parseAgentDashboardResponses({ data: [] }, response),
      /Nieprawidłowy format danych agentów lub integracji/
    );
  }
});
