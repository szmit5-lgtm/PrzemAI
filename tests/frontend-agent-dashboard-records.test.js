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
