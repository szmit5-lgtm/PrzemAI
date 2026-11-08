"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const queries = [];
const fakePrisma = {
  financialDocument: {
    async findMany(query) {
      queries.push(query);
      return [];
    }
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../../lib/prisma" &&
      parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) {
    return fakePrisma;
  }
  return originalLoad.call(this, request, parent, isMain);
};
let FinanceService;
try {
  FinanceService = require("../api/services/FinanceService");
} finally {
  Module._load = originalLoad;
}

test("financial period report reads only the signed-in user's KSeF invoices for the selected year", async () => {
  queries.length = 0;
  const report = await new FinanceService().reportPeriods("tenant-7", 2026);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].where, {
    userId: "tenant-7",
    source: "KSEF",
    issueDate: {
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lt: new Date("2027-01-01T00:00:00.000Z")
    }
  });
  assert.equal(queries[0].take, 500);
  assert.deepEqual(queries[0].orderBy, { id: "asc" });
  assert.equal(report.year, 2026);
  assert.equal(report.cashFlowAvailable, false);
  assert.match(report.explanation, /Nie oznacza wpływów/);
});

test("invalid financial report years are rejected before any database query", async () => {
  queries.length = 0;
  const service = new FinanceService();
  for (const year of ["2026.5", "not-a-year", 2019, 2101, Infinity]) {
    await assert.rejects(service.reportPeriods("tenant-7", year), /Nieprawidłowy rok/);
  }
  assert.equal(queries.length, 0);
});
