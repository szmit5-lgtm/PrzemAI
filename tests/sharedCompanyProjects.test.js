"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const calls = [];
let memberships = [];
let adminAllowed = false;
const prisma = {
  organizationMembership: {
    async findFirst(query) { calls.push(["adminMembership", query]); return adminAllowed ? { id: "membership" } : null; },
    async findMany(query) {
      calls.push(["memberships", query]);
      return memberships.map(organizationId => ({ organizationId }));
    }
  },
  project: {
    async findMany(query) { calls.push(["projects", query]); return []; },
    async findFirst(query) { calls.push(["existing", query]); return null; },
    async create(query) { calls.push(["create", query]); return query.data; },
    async updateMany(query) { calls.push(["mapLegacy", query]); return { count: 1 }; }
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

test("new projects are shared automatically when user has one active company", async () => {
  calls.length = 0;
  memberships = ["dekonica"];
  await new FinanceService().createProject("leszek", { name: "Prywatny projekt" });
  assert.deepEqual(calls.find(([type]) => type === "existing")[1].where, {
    name: "Prywatny projekt", status: "ACTIVE", organizationId: "dekonica"
  });
  assert.equal(calls.find(([type]) => type === "create")[1].data.organizationId, "dekonica");
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

test("multi-company member must select company explicitly", async () => {
  calls.length = 0;
  memberships = ["dekonica", "deherus"];
  await assert.rejects(
    () => new FinanceService().createProject("member", { name: "Nowy projekt" }),
    /Wybierz spółkę/
  );
  assert.equal(calls.some(([type]) => type === "create"), false);
});

test("user without company membership retains private project creation", async () => {
  calls.length = 0;
  memberships = [];
  await new FinanceService().createProject("personal", { name: "Prywatny projekt" });
  assert.equal(calls.find(([type]) => type === "create")[1].data.organizationId, null);
});

test("only an active company admin can share their own legacy project", async () => {
  calls.length = 0;
  adminAllowed = true;
  const result = await new FinanceService().shareLegacyProject("owner", "mielno", "dekonica");
  assert.deepEqual(result, { id: "mielno", organizationId: "dekonica" });
  const membership = calls.find(([type]) => type === "adminMembership")[1];
  assert.deepEqual(membership.where.role.in, ["OWNER", "ADMIN"]);
  const update = calls.find(([type]) => type === "mapLegacy")[1];
  assert.deepEqual(update.where, {
    id: "mielno", userId: "owner", organizationId: null, status: "ACTIVE"
  });
  adminAllowed = false;
});

test("member without admin role cannot map a legacy project", async () => {
  calls.length = 0;
  adminAllowed = false;
  await assert.rejects(
    () => new FinanceService().shareLegacyProject("member", "mielno", "dekonica"),
    /Brak uprawnień/
  );
  assert.equal(calls.some(([type]) => type === "mapLegacy"), false);
});

test("legacy mapping rejects malformed identifiers before querying the database", async () => {
  calls.length = 0;
  adminAllowed = true;
  await assert.rejects(
    () => new FinanceService().shareLegacyProject("owner", " ", "dekonica"),
    /Nieprawidłowe dane/
  );
  await assert.rejects(
    () => new FinanceService().shareLegacyProject("owner", "mielno", "x".repeat(129)),
    /Nieprawidłowe dane/
  );
  assert.equal(calls.length, 0);
  adminAllowed = false;
});

test("legacy mapping cannot transfer a project owned by another user", async () => {
  calls.length = 0;
  adminAllowed = true;
  await new FinanceService().shareLegacyProject("owner", "legacy-other-owner", "dekonica");
  const update = calls.find(([type]) => type === "mapLegacy")[1];
  assert.equal(update.where.userId, "owner");
  assert.equal(update.where.organizationId, null);
  assert.equal(update.where.status, "ACTIVE");
  adminAllowed = false;
});

test("multi-company member can explicitly create a project only in the selected tenant", async () => {
  calls.length = 0;
  memberships = ["dekonica", "deherus"];
  const result = await new FinanceService().createProject("member", {
    name: "Mielno", organizationId: "dekonica"
  });
  assert.equal(result.organizationId, "dekonica");
  assert.deepEqual(calls.find(([type]) => type === "existing")[1].where, {
    name: "Mielno", status: "ACTIVE", organizationId: "dekonica"
  });
  assert.equal(calls.find(([type]) => type === "create")[1].data.userId, "member");
});

test("project creation never trusts a foreign tenant even for multi-company members", async () => {
  calls.length = 0;
  memberships = ["dekonica", "deherus"];
  await assert.rejects(
    () => new FinanceService().createProject("member", {
      name: "Zgorzelec", organizationId: "foreign-company"
    }),
    /Brak dostępu/
  );
  assert.equal(calls.some(([type]) => type === "existing" || type === "create"), false);
});


test("Deherus-only member cannot see Dekonica projects through the shared project query", async () => {
  calls.length = 0;
  memberships = ["deherus"];
  await new FinanceService().listProjects("deherus-worker");
  const membershipQuery = calls.find(([type]) => type === "memberships")[1];
  assert.equal(membershipQuery.where.userId, "deherus-worker");
  const query = calls.find(([type]) => type === "projects")[1];
  assert.deepEqual(query.where.OR, [
    { userId: "deherus-worker", organizationId: null },
    { organizationId: { in: ["deherus"] } }
  ]);
  assert.equal(query.where.status, "ACTIVE");
  assert.equal(JSON.stringify(query.where).includes("dekonica"), false);
});
