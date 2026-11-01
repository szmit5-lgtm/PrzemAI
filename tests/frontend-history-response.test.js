"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/historyDashboardPayload.js"), "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

const analysis = {
  id: "history-1",
  title: "Analiza umowy",
  type: "DOCUMENT",
  createdAt: "2026-11-01T10:00:00.000Z"
};

test("history accepts confirmed empty and populated lists", async () => {
  const { parseHistoryListResponse } = await loadParser();
  assert.deepEqual(parseHistoryListResponse({ success: true, items: [] }), []);
  assert.deepEqual(parseHistoryListResponse({ success: true, items: [analysis] }), [analysis]);
});

test("history rejects unsuccessful or malformed responses rather than showing an empty list", async () => {
  const { parseHistoryListResponse } = await loadParser();
  for (const response of [
    null, {}, { items: [] }, { success: false, items: [] },
    { success: "true", items: [] }, { success: true, items: null },
    { success: true, items: [null] }, { success: true, items: [{ ...analysis, id: " " }] },
    { success: true, items: [{ ...analysis, title: "" }] },
    { success: true, items: [{ ...analysis, createdAt: null }] },
    { success: true, items: [analysis, analysis] }
  ]) {
    assert.throws(() => parseHistoryListResponse(response), /Nieprawidłowy format historii analiz/);
  }
});

test("history only removes an item after an explicit successful deletion acknowledgement", async () => {
  const { parseHistoryDeletionResponse } = await loadParser();
  assert.equal(parseHistoryDeletionResponse({ success: true }), true);
  for (const response of [null, {}, { success: false }, { success: "true" }]) {
    assert.throws(() => parseHistoryDeletionResponse(response), /Brak potwierdzenia usunięcia analizy/);
  }
});

test("history UI distinguishes load failure from a verified empty history and validates deletions", async () => {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/app/history/page.js"), "utf8"
  );
  assert.match(source, /setItems\(parseHistoryListResponse\(data\)\)/);
  assert.match(source, /!loading && loadError/);
  assert.match(source, /!loading && !loadError && items\.length === 0/);
  assert.match(source, /parseHistoryDeletionResponse\(response\)/);
});
