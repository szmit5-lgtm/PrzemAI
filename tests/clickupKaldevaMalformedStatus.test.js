"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createClickUpKaldevaClient } = require("../api/services/clickupKaldevaAdapter");

function clientFor(payload) {
  return createClickUpKaldevaClient({
    token: "synthetic-token",
    listId: "123",
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, undefined);
      return { ok: true, json: async () => payload };
    }
  });
}

test("null ClickUp payload fails closed", async () => {
  await assert.rejects(() => clientFor(null).listTasks(), /Malformed ClickUp response/);
});

test("invalid synthetic ClickUp statuses fail closed", async () => {
  for (const status of ["new", 123, [], { status: 1 }, { status: " " }]) {
    await assert.rejects(
      () => clientFor({ tasks: [{ id: "lead-1", name: "Synthetic lead", status }], last_page: true }).listTasks(),
      /Malformed ClickUp task/
    );
  }
});

test("valid synthetic ClickUp status is preserved", async () => {
  assert.deepEqual(
    await clientFor({ tasks: [{ id: "lead-1", name: "Synthetic lead", status: { status: "qualified" } }], last_page: true }).listTasks(),
    [{ id: "lead-1", name: "Synthetic lead", status: "qualified" }]
  );
});
