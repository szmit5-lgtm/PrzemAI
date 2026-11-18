"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const queries = [];
const fakePrisma = {
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
  Module._load = function (request, parent, isMain) {
    if (request === "../../lib/prisma" &&
        parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) {
      return fakePrisma;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  FinanceService = require("../api/services/FinanceService");
} finally {
  Module._load = originalLoad;
}

test("concurrent financial lists retain authenticated user scope despite forged filters", async () => {
  queries.length = 0;
  await Promise.all([
    new FinanceService().list("synthetic-dekonica", {
      userId: "synthetic-deherus",
      where: { userId: "synthetic-deherus" },
      limit: 5
    }),
    new FinanceService().list("synthetic-deherus", {
      userId: "synthetic-dekonica",
      where: { userId: "synthetic-dekonica" },
      limit: 7
    })
  ]);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries.map(query => query.where.userId).sort(), [
    "synthetic-deherus",
    "synthetic-dekonica"
  ].sort());
  assert.deepEqual(queries.map(query => query.take).sort((a, b) => a - b), [5, 7]);
  for (const query of queries) {
    assert.deepEqual(Object.keys(query.where), ["userId"]);
    assert.equal(query.include?.rawData, undefined);
  }
});


test("concurrent unauthenticated finance lists fail closed without leaking into valid reads", async () => {
  queries.length = 0;
  const results = await Promise.allSettled([
    new FinanceService().list(undefined, { userId: "synthetic-dekonica" }),
    new FinanceService().list("   ", { where: { userId: "synthetic-deherus" } }),
    new FinanceService().list("synthetic-authorized", { userId: "synthetic-attacker", limit: 3 })
  ]);
  assert.equal(results[0].status, "rejected");
  assert.equal(results[1].status, "rejected");
  assert.match(results[0].reason.message, /Brak identyfikatora użytkownika/);
  assert.match(results[1].reason.message, /Brak identyfikatora użytkownika/);
  assert.equal(results[2].status, "fulfilled");
  assert.equal(queries.length, 1, "only the authenticated request may reach Prisma");
  assert.deepEqual(queries[0].where, { userId: "synthetic-authorized" });
  assert.equal(queries[0].take, 3);
});
