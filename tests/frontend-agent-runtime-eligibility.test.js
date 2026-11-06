"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const frontendRoot = path.join(__dirname, "../frontend/src");

async function loadEligibility() {
  const source = await fs.readFile(path.join(frontendRoot, "lib/agentDashboardPayload.js"), "utf8");
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

test("manual runs require supported runtime and retryable status", async () => {
  const { canRunAgent } = await loadEligibility();
  assert.equal(canRunAgent({ type: "FINANCIAL", enabled: true, status: "IDLE" }), true);
  assert.equal(canRunAgent({ type: "FINANCIAL", enabled: true, status: "ERROR" }), true);
  for (const status of ["RUNNING", "PLANNED", "PENDING", "SUCCESS", "", null, undefined]) {
    assert.equal(canRunAgent({ type: "FINANCIAL", enabled: true, status }), false, String(status));
  }
  assert.equal(canRunAgent({ type: "FINANCIAL", enabled: false, status: "IDLE" }), false);
  assert.equal(canRunAgent({type:"SALES",mode:"TASK_DRAFT",enabled:true,status:"IDLE"}),true);
  assert.equal(canRunAgent({type:"SALES",mode:"TASK_DRAFT",enabled:true,status:"RUNNING"}),false);
  assert.equal(canRunAgent(null), false);
  assert.equal(canRunAgent({}), false);
});

test("planned agents without runnable mode cannot be launched from the dashboard", async () => {
  const { canRunAgent } = await loadEligibility();
  for (const type of ["EXECUTIVE", "DOCUMENT", "MEETING", "MAIL", "GENERAL", "UNKNOWN"]) {
    assert.equal(canRunAgent({ type, enabled: true, status: "IDLE" }), false, type);
  }
});

test("agent dashboard uses runtime eligibility to disable the run button", async () => {
  const source = await fs.readFile(path.join(frontendRoot, "app/agents/page.js"), "utf8");
  assert.match(source, /!canRunAgent\(a\)/);
  assert.match(source, /Zleć zadanie/);
});
