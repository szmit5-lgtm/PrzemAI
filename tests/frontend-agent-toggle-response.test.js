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

test("agent toggle accepts only an acknowledged matching state", async () => {
  const { parseAgentToggleResponse } = await loadParser();
  const agent = { id: "agent-1", enabled: false };
  assert.strictEqual(
    parseAgentToggleResponse({ success: true, data: agent }, { id: "agent-1", enabled: false }),
    agent
  );
  const integration = { id: "mail-1", enabled: true };
  assert.strictEqual(
    parseAgentToggleResponse({ success: true, data: integration }, { id: "mail-1", enabled: true }),
    integration
  );
});

test("agent toggle rejects a successful HTTP response without explicit confirmation", async () => {
  const { parseAgentToggleResponse } = await loadParser();
  for (const response of [
    null, {}, { success: false, data: { id: "agent-1", enabled: true } },
    { data: { id: "agent-1", enabled: true } },
    { success: "true", data: { id: "agent-1", enabled: true } },
    { success: true, data: null }, { success: true, data: [] }
  ]) {
    assert.throws(
      () => parseAgentToggleResponse(response, { id: "agent-1", enabled: true }),
      /Nieprawidłowe potwierdzenie/
    );
  }
});

test("agent toggle rejects mismatched IDs and unchanged states", async () => {
  const { parseAgentToggleResponse } = await loadParser();
  for (const record of [
    { id: "other-agent", enabled: true },
    { id: "agent-1", enabled: false },
    { id: "agent-1", enabled: "true" },
    { id: " ", enabled: true },
    { enabled: true }
  ]) {
    assert.throws(
      () => parseAgentToggleResponse({ success: true, data: record }, { id: "agent-1", enabled: true }),
      /Nieprawidłowe potwierdzenie/
    );
  }
});

test("agent dashboard checks toggle responses before displaying success", async () => {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/app/agents/page.js"), "utf8"
  );
  assert.match(source, /parseAgentToggleResponse\(response, \{ id: agent\.id, enabled: !agent\.enabled \}\)/);
  assert.match(source, /parseAgentToggleResponse\(response, \{ id: integration\.id, enabled: !integration\.enabled \}\)/);
});
