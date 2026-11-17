"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// Synthetic multi-tenant regression: concurrent requests must never share
// the previous request's Prisma where clause or result set.
const observed = [];
const prisma = {
  financialDocument: {
    async findMany(options) {
      observed.push(options);
      await Promise.resolve();
      return [{ id: "synthetic-" + options.where.userId, grossAmount: null, netAmount: null, vatAmount: null }];
    }
  }
};
const originalLoad = Module._load;
let FinanceService;
try {
  Module._load = function(request, parent, isMain) {
    if (request === "../../lib/prisma" &&
        parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) return prisma;
    return originalLoad.call(this, request, parent, isMain);
  };
  FinanceService = require("../api/services/FinanceService");
} finally {
  Module._load = originalLoad;
}

test("parallel finance lists retain independent authenticated user scopes", async () => {
  const [a, b] = await Promise.all([
    new FinanceService().list("synthetic-dekonica", { userId: "synthetic-deherus", limit: 1 }),
    new FinanceService().list("synthetic-deherus", { userId: "synthetic-dekonica", limit: 1 })
  ]);
  assert.equal(a[0].id, "synthetic-synthetic-dekonica");
  assert.equal(b[0].id, "synthetic-synthetic-deherus");
  assert.deepEqual(observed.map(x => x.where.userId).sort(), ["synthetic-deherus", "synthetic-dekonica"].sort());
  for (const options of observed) {
    assert.equal(options.take, 1);
    assert.equal(Object.hasOwn(options.where, "OR"), false);
  }
});
