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

test("manual agent run accepts an explicit completed result summary", async () => {
  const { parseAgentRunResponse } = await loadParser();
  const data = { summary: "Financial Agent: wiadomości 0, nowe dokumenty 0.", metadata: { newDocuments: 0 } };
  assert.strictEqual(parseAgentRunResponse({ success: true, data }), data);
});

test("manual agent run rejects HTTP 200 without an explicit successful acknowledgement", async () => {
  const { parseAgentRunResponse } = await loadParser();
  const data = { summary: "Praca zakończona." };
  for (const response of [null, {}, { data }, { success: false, data }, { success: "true", data }]) {
    assert.throws(() => parseAgentRunResponse(response), /Brak potwierdzenia zakończenia/);
  }
});

test("manual agent run rejects missing or malformed completion summaries", async () => {
  const { parseAgentRunResponse } = await loadParser();
  for (const data of [null, [], "ok", {}, { summary: "" }, { summary: "   " }, { summary: 1 }]) {
    assert.throws(() => parseAgentRunResponse({ success: true, data }), /Brak potwierdzenia zakończenia/);
  }
});

test("agent dashboard checks manual run completion before showing success", async () => {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/app/agents/page.js"), "utf8"
  );
  assert.match(source, /runAgent\(agent\.id\)\.then\(parseAgentRunResponse\)/);
  assert.match(source, /Agent zakończył pracę/);
});
