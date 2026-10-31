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

test("task dashboard accepts a verified empty task list", async () => {
  const { parseTaskDashboardResponse } = await loadParser();
  assert.deepEqual(parseTaskDashboardResponse({ success: true, items: [] }), []);
});

test("task dashboard preserves valid tasks and their statuses", async () => {
  const { parseTaskDashboardResponse } = await loadParser();
  const items = [{ id: "task-1", title: "Wyślij ofertę", status: "TODO" },
    { id: "task-2", title: "Odbiór", status: "DONE" }];
  assert.strictEqual(parseTaskDashboardResponse({ items }), items);
});

test("task dashboard rejects missing or malformed lists instead of reporting zero tasks", async () => {
  const { parseTaskDashboardResponse } = await loadParser();
  for (const response of [null, {}, { items: null }, { items: {} }, { items: "[]" }]) {
    assert.throws(() => parseTaskDashboardResponse(response), /Nieprawidłowy format danych zadań/);
  }
});

test("task dashboard rejects malformed records before rendering or mutating tasks", async () => {
  const { parseTaskDashboardResponse } = await loadParser();
  const valid = { id: "task-1", title: "Oferta", status: "TODO" };
  const invalid = [null, false, 2, "task", [], {},
    { id: null, title: "Oferta", status: "TODO" },
    { id: "", title: "Oferta", status: "TODO" },
    { id: "task-2", title: null, status: "TODO" },
    { id: "task-2", title: "Oferta", status: null }];
  for (const item of invalid) {
    assert.throws(() => parseTaskDashboardResponse({ items: [valid, item] }),
      /Nieprawidłowy format danych zadań/);
  }
});

test("task mutation accepts a valid task returned after creation", async () => {
  const { parseTaskMutationResponse } = await loadParser();
  const item = { id: "task-3", title: "Nowe zadanie", status: "TODO" };
  assert.strictEqual(parseTaskMutationResponse({ success: true, item }), item);
});

test("task mutation rejects missing and malformed records before changing UI state", async () => {
  const { parseTaskMutationResponse } = await loadParser();
  for (const response of [null, {}, { item: null }, { item: [] },
    { item: { id: "task-3", status: "TODO" } },
    { item: { id: "task-3", title: "Zadanie" } }]) {
    assert.throws(() => parseTaskMutationResponse(response), /Nieprawidłowy format danych zadań/);
  }
});

test("task completion rejects another task id or an uncompleted status", async () => {
  const { parseTaskMutationResponse } = await loadParser();
  const item = { id: "task-4", title: "Oferta", status: "DONE" };
  assert.strictEqual(parseTaskMutationResponse({ item }, { id: "task-4", status: "DONE" }), item);
  assert.throws(() => parseTaskMutationResponse({ item }, { id: "task-5", status: "DONE" }),
    /Nieprawidłowe potwierdzenie zmiany zadania/);
  assert.throws(() => parseTaskMutationResponse({ item: { ...item, status: "TODO" } },
    { id: "task-4", status: "DONE" }), /Nieprawidłowe potwierdzenie zmiany zadania/);
});

test("task deletion accepts an explicit successful API acknowledgement", async () => {
  const { parseTaskDeletionResponse } = await loadParser();
  assert.equal(parseTaskDeletionResponse({ success: true, message: "Zadanie zostało usunięte." }), true);
});

test("task deletion rejects missing or malformed acknowledgements", async () => {
  const { parseTaskDeletionResponse } = await loadParser();
  for (const response of [null, {}, { success: false }, { success: "true" }, { message: "OK" }]) {
    assert.throws(() => parseTaskDeletionResponse(response),
      /Nieprawidłowe potwierdzenie usunięcia zadania/);
  }
});
