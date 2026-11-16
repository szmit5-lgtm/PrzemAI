"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createClickUpKaldevaClient } = require("../api/services/clickupKaldevaAdapter");

test("read-only ClickUp rejects missing identifiers and names", async () => {
  for (const task of [
    { name: "Synthetic lead" },
    { id: "", name: "Synthetic lead" },
    { id: "1" },
    { id: "1", name: " " },
    null
  ]) {
    const calls = [];
    const client = createClickUpKaldevaClient({
      token: "synthetic-token",
      listId: "123",
      fetchImpl: async (url, opts) => {
        calls.push({ url, opts });
        return { ok: true, json: async () => ({ tasks: [task], last_page: true }) };
      }
    });
    await assert.rejects(() => client.listTasks(), /Malformed ClickUp task/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.method, undefined);
  }
});

test("valid synthetic ClickUp lead remains read-only", async () => {
  const client = createClickUpKaldevaClient({
    token: "synthetic-token",
    listId: "123",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ tasks: [{ id: 42, name: "Synthetic lead", status: { status: "new" } }], last_page: true })
    })
  });
  assert.deepEqual(await client.listTasks(), [{ id: "42", name: "Synthetic lead", status: "new" }]);
});
