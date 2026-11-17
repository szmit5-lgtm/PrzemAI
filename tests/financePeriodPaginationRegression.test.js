"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

test("KSeF period report pages without dropping invoice 501 and never claims bank cash flow", async () => {
  const originalLoad = Module._load;
  const calls = [];
  const invoices = Array.from({length: 501}, (_, i) => ({
    id: "invoice-" + String(i + 1).padStart(4, "0"),
    issueDate: new Date("2026-01-10T00:00:00Z"),
    source: "KSEF", direction: "INCOMING", currency: "PLN",
    grossAmount: 1, invoiceNumber: "TEST-" + i, sellerName: "Synthetic",
    metadata: {}
  }));
  const prisma = {financialDocument: {
    async findMany(query) {
      calls.push(query);
      const start = query.cursor ? invoices.findIndex(x => x.id === query.cursor.id) + 1 : 0;
      return invoices.slice(start, start + query.take);
    }
  }};
  Module._load = function(request, parent, isMain) {
    if (request === "../../lib/prisma" && parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) return prisma;
    return originalLoad.call(this, request, parent, isMain);
  };
  let FinanceService;
  try {
    delete require.cache[require.resolve("../api/services/FinanceService")];
    FinanceService = require("../api/services/FinanceService");
  } finally {
    Module._load = originalLoad;
  }
  const result = await new FinanceService().reportPeriods("synthetic-user", 2026);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].take, 500);
  assert.deepEqual(calls[1].cursor, {id: "invoice-0500"});
  assert.equal(calls[1].skip, 1);
  assert.equal(calls[0].where.userId, "synthetic-user");
  assert.equal(calls[1].where.userId, "synthetic-user");
  assert.equal(result.cashFlowAvailable, false);
  assert.equal(result.source, "KSEF_INVOICES");
  assert.match(result.explanation, /Nie oznacza wpływów/i);
});
