"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/financeDashboardPayload.js"), "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

const emptySummary = { total: 0, new: 0, mail: 0, ksef: 0 };

test("finance dashboard rejects explicitly unsuccessful invoice list responses", async () => {
  const { parseFinanceDashboardResponses } = await loadParser();
  for (const success of [false, null, 0, "true"]) {
    assert.throws(
      () => parseFinanceDashboardResponses({ success, items: [] }, { data: emptySummary }),
      /Nieprawidłowy format danych finansowych/
    );
  }
});

test("finance dashboard rejects explicitly unsuccessful summary responses", async () => {
  const { parseFinanceDashboardResponses } = await loadParser();
  for (const success of [false, null, 0, "true"]) {
    assert.throws(
      () => parseFinanceDashboardResponses({ items: [] }, { success, data: emptySummary }),
      /Nieprawidłowy format danych finansowych/
    );
  }
});

test("finance dashboard continues accepting successful and legacy responses", async () => {
  const { parseFinanceDashboardResponses } = await loadParser();
  assert.deepEqual(
    parseFinanceDashboardResponses({ success: true, items: [] }, { success: true, data: emptySummary }),
    { documents: [], summary: emptySummary }
  );
  assert.deepEqual(
    parseFinanceDashboardResponses({ items: [] }, { data: emptySummary }),
    { documents: [], summary: emptySummary }
  );
});
