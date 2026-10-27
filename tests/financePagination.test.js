"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const calls = [];
const fakePrisma = {
  financialDocument: {
    async findMany(options) {
      calls.push({ method: "findMany", options });
      return [{ id: "doc-1", grossAmount: { toString: () => "123.45" }, netAmount: null, vatAmount: null }];
    },
    async count(options) {
      calls.push({ method: "count", options });
      return 0;
    }
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../../lib/prisma" && parent?.filename?.endsWith("/api/services/FinanceService.js")) {
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

test("finance list uses stable, bounded pagination scoped to user", async () => {
  calls.length = 0;
  const items = await new FinanceService().list("user-1", {
    limit: "51", offset: "100.9", status: "NEW", source: "MAIL"
  });
  const query = calls.find(call => call.method === "findMany").options;
  assert.deepEqual(query.where, { userId: "user-1", status: "NEW", source: "MAIL" });
  assert.equal(query.take, 51);
  assert.equal(query.skip, 100);
  assert.deepEqual(query.orderBy, [
    { issueDate: "desc" },
    { createdAt: "desc" },
    { id: "desc" }
  ]);
  assert.equal(items[0].grossAmount, "123.45");
});

test("finance list rejects invalid offsets by falling back to first page", async () => {
  calls.length = 0;
  await new FinanceService().list("user-2", { offset: "-500", limit: "999999" });
  let query = calls.find(call => call.method === "findMany").options;
  assert.equal(query.skip, 0);
  assert.equal(query.take, 500);

  calls.length = 0;
  await new FinanceService().list("user-2", { offset: "not-a-number" });
  query = calls.find(call => call.method === "findMany").options;
  assert.equal(query.skip, 0);
  assert.equal(query.take, 100);

  calls.length = 0;
  await new FinanceService().list("user-2", { offset: "9999999" });
  query = calls.find(call => call.method === "findMany").options;
  assert.equal(query.skip, 100000);
});

test("finance summary scopes every aggregate query to current user", async () => {
  calls.length = 0;
  const summary = await new FinanceService().summary("user-3");
  assert.deepEqual(summary, { total: 0, new: 0, mail: 0, ksef: 0 });
  const counts = calls.filter(call => call.method === "count");
  assert.equal(counts.length, 4);
  for (const call of counts) assert.equal(call.options.where.userId, "user-3");
});
