"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const calls = [];
const prisma = { financialDocument: {
  async findMany(query) {
    calls.push(query);
    return [{
      id: "synthetic-doc-1",
      source: "KSEF",
      direction: "INCOMING",
      invoiceNumber: "SYNTH-001",
      rawData: "<synthetic-xml>private</synthetic-xml>",
      metadata: {},
      netAmount: 100,
      vatAmount: 23,
      grossAmount: 123
    }];
  }
} };
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

test("list rejects cross-tenant Prisma filters and redacts KSeF raw XML", async () => {
  const service = new FinanceService();
  const result = await service.list("synthetic-tenant-a", {
    source: { not: "KSEF" },
    status: { not: "NEW" },
    userId: "synthetic-tenant-b",
    limit: 99999,
    offset: -100
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { userId: "synthetic-tenant-a" });
  assert.equal(calls[0].take, 500);
  assert.equal(calls[0].skip, 0);
  assert.equal(result[0].rawData, null);
  assert.equal(result[0].grossAmount, "123");
});

test("list fails closed on missing tenant before database access", async () => {
  calls.length = 0;
  await assert.rejects(() => new FinanceService().list("", { limit: 10 }), /identyfikatora/);
  assert.equal(calls.length, 0);
});
