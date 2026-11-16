"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const calls = [];
let memberships = [];
const prisma = {
  organizationMembership: {
    async findMany(query) {
      calls.push(["memberships", query]);
      return memberships.map(organizationId => ({ organizationId }));
    }
  },
  project: {
    async findMany(query) { calls.push(["projects", query]); return []; },
    async findFirst(query) { calls.push(["existing", query]); return null; },
    async create(query) { calls.push(["create", query]); return query.data; }
  }
};
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "../../lib/prisma" &&
      parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) return prisma;
  return load.call(this, request, parent, isMain);
};
let FinanceService;
try { FinanceService = require("../api/services/FinanceService"); }
finally { Module._load = load; }

test("active company members can see company projects but not other users' legacy projects", async () => {
  calls.length = 0;
  memberships = ["dekonica"];
  await new FinanceService().listProjects("leszek");
  const memberQuery = calls.find(([type]) => type === "memberships")[1];
  assert.deepEqual(memberQuery.where, {
    userId: "leszek", status: "ACTIVE", organization: { status: "ACTIVE" }
  });
  const where = calls.find(([type]) => type === "projects")[1].where;
  assert.deepEqual(where.OR, [
    { userId: "leszek", organizationId: null },
    { organizationId: { in: ["dekonica"] } }
  ]);
  assert.equal(where.status, "ACTIVE");
});

test("user without membership cannot create project for a foreign company", async () => {
  calls.length = 0;
  memberships = [];
  await assert.rejects(
    () => new FinanceService().createProject("outsider", {
      name: "Mielno", organizationId: "dekonica"
    }),
    /Brak dostępu/
  );
  assert.equal(calls.some(([type]) => type === "create"), false);
});

test("authorized company project is scoped to its organization", async () => {
  calls.length = 0;
  memberships = ["dekonica"];
  const item = await new FinanceService().createProject("leszek", {
    name: "Zgorzelec", organizationId: "dekonica"
  });
  assert.equal(item.organizationId, "dekonica");
  assert.deepEqual(calls.find(([type]) => type === "existing")[1].where, {
    name: "Zgorzelec", status: "ACTIVE", organizationId: "dekonica"
  });
});

test("legacy projects stay personal until explicitly mapped to an organization", async () => {
  calls.length = 0;
  memberships = ["dekonica"];
  await new FinanceService().createProject("leszek", { name: "Prywatny projekt" });
  assert.deepEqual(calls.find(([type]) => type === "existing")[1].where, {
    name: "Prywatny projekt", status: "ACTIVE", userId: "leszek", organizationId: null
  });
  assert.equal(calls.find(([type]) => type === "create")[1].data.organizationId, null);
});

test("inactive membership cannot list another user's company projects", async () => {
  calls.length = 0;
  memberships = [];
  await new FinanceService().listProjects("outsider");
  const query = calls.find(([type]) => type === "projects")[1];
  assert.deepEqual(query.where.OR, [
    { userId: "outsider", organizationId: null },
    { organizationId: { in: [] } }
  ]);
});

test("company membership does not grant access to financial documents", async () => {
  calls.length = 0;
  memberships = ["dekonica"];
  prisma.financialDocument = {
    async findMany(query) { calls.push(["documents", query]); return []; }
  };
  await new FinanceService().list("leszek");
  assert.deepEqual(calls.find(([type]) => type === "documents")[1].where, { userId: "leszek" });
});
