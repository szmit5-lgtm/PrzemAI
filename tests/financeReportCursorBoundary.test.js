"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// Synthetic-only regression: a year report must read every page and never
// accidentally include documents from a different signed-in tenant.
const calls = [];
const docs = Array.from({ length: 501 }, (_, i) => ({
  id: "invoice-" + String(i + 1).padStart(4, "0"),
  issueDate: new Date("2026-01-15T12:00:00.000Z"),
  source: "KSEF",
  direction: "INCOMING",
  currency: "PLN",
  grossAmount: 100,
  invoiceNumber: "TEST/" + (i + 1),
  sellerName: "Synthetic supplier",
  metadata: {}
}));
const prisma = {
  financialDocument: {
    async findMany(query) {
      calls.push(query);
      const start = query.cursor
        ? docs.findIndex(item => item.id === query.cursor.id) + 1
        : 0;
      return docs.slice(start, start + query.take);
    }
  }
};
const originalLoad = Module._load;
let FinanceService;
try {
  Module._load = function(request, parent, isMain) {
    if (request === "../../lib/prisma" &&
        parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) {
      return prisma;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  FinanceService = require("../api/services/FinanceService");
} finally {
  Module._load = originalLoad;
}

test("KSeF period report traverses 500-item boundary with tenant and date filters", async () => {
  calls.length = 0;
  const result = await new FinanceService().reportPeriods("synthetic-tenant-A", 2026);
  assert.equal(result.year, 2026);
  assert.equal(result.cashFlowAvailable, false);
  assert.equal(calls.length, 2, "501 records require two database pages");
  assert.equal(calls[0].take, 500);
  assert.equal(calls[1].take, 500);
  assert.deepEqual(calls[1].cursor, { id: "invoice-0500" });
  assert.equal(calls[1].skip, 1);
  for (const query of calls) {
    assert.equal(query.where.userId, "synthetic-tenant-A");
    assert.equal(query.where.source, "KSEF");
    assert.equal(query.where.issueDate.gte.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(query.where.issueDate.lt.toISOString(), "2027-01-01T00:00:00.000Z");
    assert.deepEqual(query.orderBy, { id: "asc" });
  }
});

test("invalid period year fails before any database query", async () => {
  calls.length = 0;
  await assert.rejects(new FinanceService().reportPeriods("synthetic-tenant-A", "2026.5"), /Nieprawidłowy rok/);
  assert.equal(calls.length, 0);
});
