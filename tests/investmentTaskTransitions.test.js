"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { transitionInvestmentTask } = require("../lib/investmentTaskTransitions");
const base = Object.freeze([
  Object.freeze({ id: "task-a", organizationId: "tenant-demo-a", synthetic: true, status: "todo" }),
  Object.freeze({ id: "task-b", organizationId: "tenant-demo-b", synthetic: true, status: "todo" })
]);
test("transition updates only matching synthetic tenant and preserves input", () => {
  const updated = transitionInvestmentTask(base, { organizationId: "tenant-demo-a", taskId: "task-a", expectedStatus: "todo", toStatus: "in_progress" });
  assert.equal(updated[0].status, "in_progress");
  assert.strictEqual(updated[1], base[1]);
  assert.equal(base[0].status, "todo");
});
test("reject cross-tenant, stale and illegal transitions", () => {
  const request = { organizationId: "tenant-demo-b", taskId: "task-a", expectedStatus: "todo", toStatus: "done" };
  assert.throws(() => transitionInvestmentTask(base, request), /task not found/);
  assert.throws(() => transitionInvestmentTask(base, { ...request, organizationId: "tenant-demo-a" }), /transition not allowed/);
  assert.throws(() => transitionInvestmentTask(base, { ...request, organizationId: "tenant-demo-a", expectedStatus: "blocked", toStatus: "in_progress" }), /stale/);
});
test("reject real tenants and non-synthetic records", () => {
  assert.throws(() => transitionInvestmentTask(base, { organizationId: "real-org", taskId: "task-a", expectedStatus: "todo", toStatus: "in_progress" }), /synthetic/);
  const unsafe = [{ id: "task-a", organizationId: "tenant-demo-a", synthetic: false, status: "todo" }];
  assert.throws(() => transitionInvestmentTask(unsafe, { organizationId: "tenant-demo-a", taskId: "task-a", expectedStatus: "todo", toStatus: "in_progress" }), /task not found/);
});
