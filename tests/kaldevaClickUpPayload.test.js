"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { mapLeadToClickUpTask } = require("../api/services/kaldevaClickUpPayload");
const options = { authorizedOrganizationId: "kaldeva-test", listId: "12345", allowedListId: "12345" };

test("maps synthetic lead to ClickUp payload without contact details", () => {
  const payload = mapLeadToClickUpTask({ organizationId: "kaldeva-test", name: "Lead Testowy", stage: "OFFER", email: "fake@example.test", assigneeId: "123" }, options);
  assert.deepEqual(payload, { list_id: "12345", name: "Lead Testowy", description: "PrzemAI Kaldeva CRM — status: Oferta wysłana", assignees: [123] });
  assert.doesNotMatch(JSON.stringify(payload), /fake@example/);
});
test("rejects other tenant and unauthorized ClickUp list", () => {
  assert.throws(() => mapLeadToClickUpTask({ organizationId: "other", name: "Synthetic" }, options), /organization access denied/);
  assert.throws(() => mapLeadToClickUpTask({ organizationId: "kaldeva-test", name: "Synthetic" }, { ...options, listId: "999" }), /list not authorized/);
});
test("rejects invalid stages, assignees, and missing names", () => {
  for (const change of [{ stage: "UNKNOWN" }, { assigneeId: "not-id" }, { name: "" }]) {
    assert.throws(() => mapLeadToClickUpTask({ organizationId: "kaldeva-test", name: "Synthetic", ...change }, options));
  }
});
