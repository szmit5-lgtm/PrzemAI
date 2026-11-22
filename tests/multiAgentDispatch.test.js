"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDispatch, dispatchPlan } = require("../api/services/MultiAgentDispatchService");

const valid = { title: "Plan analizy inwestycji", assignments: [
  { agentKey: "construction", instruction: "Przygotuj raport postępu prac." },
  { agentKey: "offer", instruction: "Przygotuj projekt oferty." }
] };

test("multi-agent dispatch accepts only bounded draft agents", () => {
  assert.equal(validateDispatch(valid).assignments.length, 2);
  assert.throws(() => validateDispatch({ ...valid, assignments: [
    { agentKey: "financial", instruction: "Przelej pieniądze." }
  ] }), /Nieobsługiwany/);
  assert.throws(() => validateDispatch({ ...valid, assignments: Array(6).fill(valid.assignments[0]) }), /od 1 do 5/);
  assert.throws(() => validateDispatch({ ...valid, assignments: [valid.assignments[0], valid.assignments[0]] }), /tylko raz/);
});

test("dispatch writes tenant-scoped queued tasks atomically without executing them", async () => {
  const rows = [], updates = [], scopes = [];
  const db = { $transaction: async fn => fn({
    agent: {
      findFirst: async ({ where }) => {
        scopes.push(where);
        return { id: "agent-" + where.key };
      },
      updateMany: async opts => { updates.push(opts); return { count: 1 }; }
    },
    task: { create: async ({ data }) => {
      rows.push(data);
      return { id: "task-" + rows.length, status: data.status };
    } }
  }) };
  const result = await dispatchPlan({ userId: "owner-a", payload: valid, db });
  assert.equal(result.assignments.length, 2);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(x => x.userId === "owner-a" && x.status === "TODO" && x.source === "AGENT"));
  assert.ok(scopes.every(x => x.userId === "owner-a" && x.enabled === true));
  assert.ok(updates.every(x => x.where.userId === "owner-a"));
});
