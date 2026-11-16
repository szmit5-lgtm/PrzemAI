"use strict";

// Synthetic regression cases for untrusted HTTP query values in finance list.
// These tests intentionally do not access a real database or account.
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const queries = [];
const prisma = {
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
    return prisma;
  }
  return originalLoad.call(this, request, parent, isMain);
};
let FinanceService;
try {
  FinanceService = require("../api/services/FinanceService");
} finally {
  Module._load = originalLoad;
}

test("array query parameters cannot broaden finance document filters", async () => {
  queries.length = 0;
  await new FinanceService().list("tenant-alpha", {
    status: ["NEW", "PAID"],
    source: ["KSEF", "MAIL"],
    userId: "tenant-beta",
    where: { OR: [{ userId: "tenant-beta" }] }
  });
  assert.deepEqual(queries[0].where, { userId: "tenant-alpha" });
});

test("malformed filter strings are ignored instead of reaching Prisma", async () => {
  queries.length = 0;
  await new FinanceService().list("tenant-alpha", {
    status: "NEW|PAID",
    source: "KSEF\\u0000",
    limit: "NaN",
    offset: "Infinity"
  });
  assert.deepEqual(queries[0].where, { userId: "tenant-alpha" });
  assert.equal(queries[0].take, 100);
  assert.equal(queries[0].skip, 0);
});

test("valid filter values remain scoped to authenticated tenant", async () => {
  queries.length = 0;
  await new FinanceService().list("tenant-alpha", {
    status: "NEW",
    source: "KSEF",
    userId: "tenant-beta"
  });
  assert.deepEqual(queries[0].where, {
    userId: "tenant-alpha", status: "NEW", source: "KSEF"
  });
});
