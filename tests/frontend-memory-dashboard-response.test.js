"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/memoryDashboardPayload.js"), "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

const memory = { id: "memory-1", type: "PROJECT", title: "Oferta", content: "Termin do piątku" };

test("memory dashboard accepts confirmed empty and populated lists", async () => {
  const { parseMemoryListResponse } = await loadParser();
  assert.deepEqual(parseMemoryListResponse({ success: true, memories: [] }), []);
  assert.deepEqual(parseMemoryListResponse({ success: true, memories: [memory] }), [memory]);
});

test("memory dashboard rejects failed and malformed lists instead of showing an empty memory", async () => {
  const { parseMemoryListResponse } = await loadParser();
  for (const response of [
    null, {}, { memories: [] }, { success: false, memories: [] },
    { success: "true", memories: [] }, { success: true, memories: null },
    { success: true, memories: [null] }, { success: true, memories: [{ ...memory, id: "" }] },
    { success: true, memories: [{ ...memory, title: null }] },
    { success: true, memories: [{ ...memory, content: "" }] },
    { success: true, memories: [memory, memory] }
  ]) {
    assert.throws(() => parseMemoryListResponse(response), /Nieprawidłowy format danych pamięci AI/);
  }
});

test("memory changes require an explicit acknowledgement and the expected record ID", async () => {
  const { parseMemoryMutationResponse } = await loadParser();
  assert.deepEqual(parseMemoryMutationResponse({ success: true, memory }), memory);
  assert.deepEqual(parseMemoryMutationResponse({ success: true, memory }, memory.id), memory);
  for (const response of [
    null, {}, { success: false, memory }, { success: "true", memory },
    { success: true }, { success: true, memory: { ...memory, id: "" } },
    { success: true, memory: { ...memory, id: "another-id" } }
  ]) {
    assert.throws(() => parseMemoryMutationResponse(response, memory.id), /Brak potwierdzenia zmiany pamięci AI/);
  }
});

test("archive requires a valid archive timestamp before removing a memory from the page", async () => {
  const { parseMemoryMutationResponse } = await loadParser();
  const archived = { ...memory, archivedAt: "2026-11-01T16:00:00.000Z" };
  assert.deepEqual(parseMemoryMutationResponse({ success: true, memory: archived }, memory.id, true), archived);
  for (const archivedAt of [null, undefined, "", "not-a-date"]) {
    assert.throws(
      () => parseMemoryMutationResponse({ success: true, memory: { ...memory, archivedAt } }, memory.id, true),
      /Brak potwierdzenia zmiany pamięci AI/
    );
  }
});

test("memory UI validates API responses and distinguishes load failure from an empty list", async () => {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/app/memory/page.js"), "utf8"
  );
  assert.match(source, /setMemories\(parseMemoryListResponse\(response\)\)/);
  assert.match(source, /parseMemoryMutationResponse\(response, editingId\)/);
  assert.match(source, /parseMemoryMutationResponse\(response, id, true\)/);
  assert.match(source, /!loading && loadError/);
  assert.match(source, /!loadError && filteredMemories\.length === 0/);
});
