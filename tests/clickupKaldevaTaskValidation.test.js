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

test("duplicate synthetic ClickUp lead IDs across pages fail closed", async () => {
  let calls = 0;
  const client = createClickUpKaldevaClient({
    token: "synthetic-token",
    listId: "123",
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.method, undefined);
      return {
        ok: true,
        json: async () => ({
          tasks: [{ id: "lead-1", name: "Synthetic lead " + calls }],
          last_page: calls === 2
        })
      };
    }
  });
  await assert.rejects(() => client.listTasks(), /Duplicate ClickUp task id/);
  assert.equal(calls, 2);
});

test("unique synthetic ClickUp leads across pages are returned completely", async () => {
  let calls = 0;
  const client = createClickUpKaldevaClient({
    token: "synthetic-token",
    listId: "123",
    fetchImpl: async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          tasks: [{ id: "lead-" + calls, name: "Synthetic lead" }],
          last_page: calls === 2
        })
      };
    }
  });
  assert.deepEqual((await client.listTasks()).map(task => task.id), ["lead-1", "lead-2"]);
  assert.equal(calls, 2);
});
