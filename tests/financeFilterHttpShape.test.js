"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// Synthetic-only regression: untrusted HTTP query arrays/objects must not become Prisma operators.
const queries = [];
const fakePrisma = {
  financialDocument: {
    async findMany(options) { queries.push(options); return []; },
    async count() { return 0; }
  }
};
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../../lib/prisma" &&
      parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) {
    return fakePrisma;
  }
  return load.call(this, request, parent, isMain);
};
let FinanceService;
try { FinanceService = require("../api/services/FinanceService"); }
finally { Module._load = load; }

test("financial list rejects array and nested query filters without tenant escape", async () => {
  const service = new FinanceService();
  for (const malicious of [
    { status: ["NEW", "PAID"], source: ["KSEF"] },
    { status: { equals: "NEW" }, source: { not: "MAIL" } },
    { status: null, source: false },
    { status: 123, source: { in: ["MAIL", "KSEF"] } }
  ]) {
    queries.length = 0;
    await service.list("tenant-dekonica", {
      ...malicious, userId: "tenant-deherus",
      where: { OR: [{ userId: "tenant-deherus" }] }
    });
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].where, { userId: "tenant-dekonica" });
  }
});

test("financial list preserves valid string filters for authorized tenant", async () => {
  queries.length = 0;
  await new FinanceService().list("tenant-deherus", { status: "NEW", source: "KSEF" });
  assert.deepEqual(queries[0].where, {
    userId: "tenant-deherus", status: "NEW", source: "KSEF"
  });
});
