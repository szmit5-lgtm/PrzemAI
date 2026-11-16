"use strict";

// Synthetic boundary regression for annual KSeF reporting; no external data.
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const queries = [];
const prisma = {
  financialDocument: {
    async findMany(options) {
      queries.push(options);
      return [];
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

test("annual KSeF report uses exclusive next-year boundary and authenticated tenant", async () => {
  queries.length = 0;
  const result = await new FinanceService().reportPeriods("synthetic-tenant-a", 2026);
  assert.equal(result.year, 2026);
  assert.equal(result.cashFlowAvailable, false);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].where, {
    userId: "synthetic-tenant-a",
    source: "KSEF",
    issueDate: {
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lt: new Date("2027-01-01T00:00:00.000Z")
    }
  });
  assert.deepEqual(queries[0].orderBy, { id: "asc" });
  assert.equal(queries[0].take, 500);
});

test("invalid annual report years fail before any database call", async () => {
  const service = new FinanceService();
  for (const year of [2019, 2101, "2026.5", "invalid", Infinity, null]) {
    queries.length = 0;
    await assert.rejects(service.reportPeriods("synthetic-tenant-a", year), /Nieprawidłowy rok/);
    assert.equal(queries.length, 0);
  }
});

test("annual report refuses missing tenant before database reads", async () => {
  queries.length = 0;
  await assert.rejects(new FinanceService().reportPeriods("", 2026), /Brak identyfikatora/);
  assert.equal(queries.length, 0);
});
