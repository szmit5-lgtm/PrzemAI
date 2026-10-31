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

test("finance dashboard accepts a verified empty document list and zero summary", async () => {
  const { parseFinanceDashboardResponses } = await loadParser();
  assert.deepEqual(
    parseFinanceDashboardResponses({ success: true, items: [] }, { success: true, data: emptySummary }),
    { documents: [], summary: emptySummary }
  );
});

test("finance dashboard preserves documents for pagination and nonzero counts", async () => {
  const { parseFinanceDashboardResponses } = await loadParser();
  const documents = Array.from({ length: 51 }, (_, index) => ({ id: "invoice-" + index }));
  const summary = { total: 60, new: 5, mail: 40, ksef: 20 };
  const parsed = parseFinanceDashboardResponses({ items: documents }, { data: summary });
  assert.equal(parsed.documents.length, 51);
  assert.strictEqual(parsed.documents, documents);
  assert.deepEqual(parsed.summary, summary);
});

test("finance dashboard rejects missing or malformed document lists instead of showing no invoices", async () => {
  const { parseFinanceDashboardResponses } = await loadParser();
  for (const response of [null, {}, { items: null }, { items: {} }, { items: "[]" }]) {
    assert.throws(() => parseFinanceDashboardResponses(response, { data: emptySummary }),
      /Nieprawidłowy format danych finansowych/);
  }
});

test("finance dashboard rejects malformed invoice records before rendering", async () => {
  const { parseFinanceDashboardResponses } = await loadParser();
  for (const invalid of [null, false, 3, "invoice", []]) {
    assert.throws(() => parseFinanceDashboardResponses({ items: [{ id: "ok" }, invalid] }, { data: emptySummary }),
      /Nieprawidłowy format danych finansowych/);
  }
});

test("finance dashboard rejects missing, negative and non-numeric summary counts", async () => {
  const { parseFinanceDashboardResponses } = await loadParser();
  const invalidSummaries = [null, {}, [], { ...emptySummary, total: -1 },
    { ...emptySummary, mail: "0" }, { ...emptySummary, ksef: 0.5 },
    { ...emptySummary, new: null }];
  for (const summary of invalidSummaries) {
    assert.throws(() => parseFinanceDashboardResponses({ items: [] }, { data: summary }),
      /Nieprawidłowy format danych finansowych/);
  }
});
