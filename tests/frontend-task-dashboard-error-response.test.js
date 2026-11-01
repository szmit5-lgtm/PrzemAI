"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/taskDashboardPayload.js"), "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

test("task dashboard never displays a failed API response as a valid task list", async () => {
  const { parseTaskDashboardResponse } = await loadParser();
  const item = { id: "task-1", title: "Oferta", status: "TODO" };
  for (const success of [false, null, 0, "true"]) {
    assert.throws(
      () => parseTaskDashboardResponse({ success, items: [item] }),
      /Nieprawidłowy format danych zadań/
    );
  }
  assert.deepEqual(parseTaskDashboardResponse({ success: true, items: [item] }), [item]);
  assert.deepEqual(parseTaskDashboardResponse({ items: [item] }), [item]);
});

test("task mutation never accepts a failed API acknowledgement as a saved change", async () => {
  const { parseTaskMutationResponse } = await loadParser();
  const item = { id: "task-1", title: "Oferta", status: "DONE" };
  for (const success of [false, null, 0, "true"]) {
    assert.throws(
      () => parseTaskMutationResponse({ success, item }, { id: "task-1", status: "DONE" }),
      /Nieprawidłowe potwierdzenie zmiany zadania/
    );
  }
  assert.strictEqual(
    parseTaskMutationResponse({ success: true, item }, { id: "task-1", status: "DONE" }),
    item
  );
  assert.strictEqual(parseTaskMutationResponse({ item }), item);
});
