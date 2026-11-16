"use strict";

// Synthetic pagination regression: no database, credentials, or real invoices.
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const calls = [];
const records = Array.from({ length: 501 }, (_, i) => ({
  id: "synthetic-invoice-" + String(i).padStart(4, "0"),
  issueDate: new Date("2026-03-01T00:00:00.000Z"),
  source: "KSEF",
  direction: "INCOMING",
  currency: "PLN",
  grossAmount: 10,
  invoiceNumber: "TEST-" + i,
  sellerName: "Synthetic supplier",
  metadata: {}
}));
const prisma = { financialDocument: {
  async findMany(options) {
    calls.push(options);
    const start = options.cursor
      ? records.findIndex(item => item.id === options.cursor.id) + 1
      : 0;
    return records.slice(start, start + options.take);
  }
}};
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

test("KSeF annual report paginates past 500 synthetic invoices without changing tenant", async () => {
  calls.length = 0;
  const result = await new FinanceService().reportPeriods("synthetic-tenant-a", 2026);
  assert.equal(result.year, 2026);
  assert.equal(result.cashFlowAvailable, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].take, 500);
  assert.equal(calls[1].take, 500);
  assert.deepEqual(calls[1].cursor, { id: records[499].id });
  assert.equal(calls[1].skip, 1);
  for (const call of calls) {
    assert.equal(call.where.userId, "synthetic-tenant-a");
    assert.equal(call.where.source, "KSEF");
    assert.deepEqual(call.orderBy, { id: "asc" });
  }
});
