"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createClickUpKaldevaClient } = require("../api/services/clickupKaldevaAdapter");

test("offline ClickUp read-only client verifies list and pages without writing", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const data = url.endsWith("/list/123") ? { id: "123", name: "Kaldeva" }
      : url.includes("page=0") ? { tasks: [{ id: "1", name: "Synthetic lead", status: { status: "to do" } }], last_page: false }
      : { tasks: [], last_page: true };
    return { ok: true, json: async () => data };
  };
  const client = createClickUpKaldevaClient({ token: "synthetic-token", listId: "123", fetchImpl });
  assert.deepEqual(await client.checkList(), { id: "123", name: "Kaldeva" });
  assert.deepEqual(await client.listTasks(), [{ id: "1", name: "Synthetic lead", status: "to do" }]);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(c => c.opts.method === undefined && c.opts.headers.Authorization === "synthetic-token"));
});

test("missing credentials, malformed data and HTTP errors fail closed", async () => {
  assert.throws(() => createClickUpKaldevaClient({ token: "", listId: "123" }), /TOKEN/);
  assert.throws(() => createClickUpKaldevaClient({ token: "fake", listId: "x" }), /LIST_ID/);
  const bad = createClickUpKaldevaClient({ token: "fake", listId: "123", fetchImpl: async () => ({ ok: true, json: async () => ({ tasks: null }) }) });
  await assert.rejects(() => bad.listTasks(), /Malformed/);
  const denied = createClickUpKaldevaClient({ token: "fake", listId: "123", fetchImpl: async () => ({ ok: false, status: 401 }) });
  await assert.rejects(() => denied.checkList(), /HTTP 401/);
  await assert.rejects(() => bad.listTasks({ maxPages: 11 }), /page limit/);
});
