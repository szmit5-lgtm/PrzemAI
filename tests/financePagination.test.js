"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const calls = [];
let nextDocuments = null;
const fakePrisma = {
  project: {
    async findMany(options) {
      calls.push({ method: "project.findMany", options });
      return [];
    }
  },
  financialDocument: {
    async findFirst(options) {
      calls.push({ method: "findFirst", options });
      return null;
    },
    async findMany(options) {
      calls.push({ method: "findMany", options });
      return nextDocuments || [{ id: "doc-1", grossAmount: { toString: () => "123.45" }, netAmount: null, vatAmount: null }];
    },
    async count(options) {
      calls.push({ method: "count", options });
      return 0;
    }
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../../lib/prisma" && parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) {
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

test("finance list normalizes fractional limits before querying Prisma", async () => {
  calls.length = 0;
  await new FinanceService().list("user-4", { limit: "10.75", offset: "3.8" });
  const query = calls.find(call => call.method === "findMany").options;
  assert.equal(query.take, 10);
  assert.equal(query.skip, 3);
  assert.equal(Number.isInteger(query.take), true);
});


test("finance list never exposes full KSeF XML in a paginated response", async () => {
  nextDocuments = [{
    id: "ksef-1", source: "KSEF", direction: "INCOMING",
    invoiceNumber: "FV/1", sellerName: "Dostawca",
    rawData: { xml: "<Invoice>private invoice content</Invoice>" },
    metadata: {}, grossAmount: null, netAmount: null, vatAmount: null
  }];
  try {
    const items = await new FinanceService().list("user-1");
    assert.equal(items.length, 1);
    assert.equal(items[0].rawData, null);
    assert.equal(items[0].displayTitle, "Zakup · Dostawca · FV/1");
    assert.equal(JSON.stringify(items).includes("private invoice content"), false);
  } finally {
    nextDocuments = null;
  }
});


test("finance detail lookup validates IDs and scopes reads to the signed-in user", async () => {
  calls.length = 0;
  const service = new FinanceService();
  for (const id of [null, "", "   ", "x".repeat(129), 42]) {
    assert.equal(await service.one("user-5", id), null);
  }
  assert.equal(calls.length, 0, "invalid document IDs must not query the database");

  assert.equal(await service.one("user-5", "doc-123"), null);
  assert.deepEqual(calls, [{
    method: "findFirst",
    options: {
      where: { id: "doc-123", userId: "user-5" },
      include: { project: { select: { id: true, name: true } } }
    }
  }]);
});


test("finance list ignores caller-supplied tenant and unapproved query fields", async () => {
  calls.length = 0;
  await new FinanceService().list("authorized-user", {
    userId: "another-user",
    where: { userId: "another-user" },
    include: { rawData: true },
    orderBy: { createdAt: "asc" },
    limit: 25,
    offset: 0
  });
  const query = calls.find(call => call.method === "findMany").options;
  assert.deepEqual(query.where, { userId: "authorized-user" });
  assert.deepEqual(query.include, { project: { select: { id: true, name: true } } });
  assert.deepEqual(query.orderBy, [
    { issueDate: "desc" },
    { createdAt: "desc" },
    { id: "desc" }
  ]);
  assert.equal(query.take, 25);
  assert.equal(query.skip, 0);
});


test("finance list fails closed without an authenticated tenant", async () => {
  const service = new FinanceService();
  for (const userId of [undefined, null, "", "   ", 42]) {
    calls.length = 0;
    await assert.rejects(service.list(userId), /Brak identyfikatora użytkownika/);
    assert.equal(calls.length, 0, "missing tenant must not query financial documents");
  }
});

test("finance detail fails closed without an authenticated tenant", async () => {
  const service = new FinanceService();
  for (const userId of [undefined, null, "", "   ", 42]) {
    calls.length = 0;
    assert.equal(await service.one(userId, "doc-123"), null);
    assert.equal(calls.length, 0, "missing tenant must not query financial documents");
  }
});


test("finance summary fails closed without an authenticated tenant", async () => {
  const service = new FinanceService();
  for (const userId of [undefined, null, "", "   ", 42]) {
    calls.length = 0;
    await assert.rejects(service.summary(userId), /Brak identyfikatora użytkownika/);
    assert.equal(calls.length, 0, "missing tenant must not run aggregate queries");
  }
});


test("finance project list rejects missing tenant without database reads", async () => {
  const service = new FinanceService();
  for (const userId of [undefined, null, "", "   ", 42]) {
    calls.length = 0;
    await assert.rejects(service.listProjects(userId), /Brak identyfikatora użytkownika/);
    assert.equal(calls.length, 0, "missing tenant must not query projects");
  }
  calls.length = 0;
  assert.deepEqual(await service.listProjects("user-7"), []);
  assert.deepEqual(calls[0], {
    method: "project.findMany",
    options: {
      where: { userId: "user-7", status: "ACTIVE" },
      select: { id: true, name: true, aliases: true, company: true },
      orderBy: { name: "asc" },
      take: 300
    }
  });
});
