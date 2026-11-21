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
prisma.projectAccess = {
  async upsert(query) { calls.push(["grant", query]); return {}; },
  async deleteMany(query) { calls.push(["revoke", query]); return { count: 1 }; }
};
let projectForAccess = { id: "mielno", organizationId: "dekonica" };
let targetAllowed = true;
const originalProjectFindFirst = prisma.project.findFirst;
prisma.project.findFirst = async query => {
  if (query.where?.organizationId?.not === null) {
    calls.push(["accessProject", query]);
    return projectForAccess;
  }
  return originalProjectFindFirst(query);
};
const originalMembershipFindFirst = prisma.organizationMembership.findFirst;
prisma.organizationMembership.findFirst = async query => {
  if (query.where?.role) return originalMembershipFindFirst(query);
  calls.push(["targetMembership", query]);
  return targetAllowed ? { id: "target" } : null;
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
    { organizationId: { in: ["dekonica"] }, userId: "leszek" },
    { organizationId: { in: ["dekonica"] }, projectAccesses: { some: { userId: "leszek" } } },
    { organizationId: { in: ["dekonica"] }, organization: { memberships: { some: { userId: "leszek", status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } } } } }
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
    { organizationId: { in: [] }, userId: "outsider" },
    { organizationId: { in: [] }, projectAccesses: { some: { userId: "outsider" } } },
    { organizationId: { in: [] }, organization: { memberships: { some: { userId: "outsider", status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } } } } }
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
    { organizationId: { in: ["deherus"] }, userId: "deherus-worker" },
    { organizationId: { in: ["deherus"] }, projectAccesses: { some: { userId: "deherus-worker" } } },
    { organizationId: { in: ["deherus"] }, organization: { memberships: { some: { userId: "deherus-worker", status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } } } } }
  ]);
  assert.equal(query.where.status, "ACTIVE");
  assert.equal(JSON.stringify(query.where).includes("dekonica"), false);
});

test("legacy mapping fails closed when project is absent or already shared", async () => {
  calls.length = 0;
  adminAllowed = true;
  const original = prisma.project.updateMany;
  prisma.project.updateMany = async query => {
    calls.push(["mapLegacy", query]);
    return { count: 0 };
  };
  try {
    await assert.rejects(
      () => new FinanceService().shareLegacyProject("synthetic-owner", "synthetic-project", "synthetic-org"),
      /Projekt nie istnieje lub został już przypisany/
    );
    const membership = calls.find(([type]) => type === "adminMembership")[1];
    assert.deepEqual(membership.where, {
      userId: "synthetic-owner", organizationId: "synthetic-org", status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] }, organization: { status: "ACTIVE" }
    });
    const update = calls.find(([type]) => type === "mapLegacy")[1];
    assert.deepEqual(update.where, {
      id: "synthetic-project", userId: "synthetic-owner", organizationId: null, status: "ACTIVE"
    });
    assert.deepEqual(update.data, { organizationId: "synthetic-org" });
  } finally {
    prisma.project.updateMany = original;
    adminAllowed = false;
  }
});

test("admin grants and revokes project access only for active company member", async () => {
  calls.length = 0; adminAllowed = true; targetAllowed = true;
  const service = new FinanceService();
  await service.setProjectAccess("admin", "mielno", "leszek", true);
  assert.deepEqual(calls.find(([kind]) => kind === "grant")[1].where,
    { projectId_userId: { projectId: "mielno", userId: "leszek" } });
  await service.setProjectAccess("admin", "mielno", "leszek", false);
  assert.deepEqual(calls.find(([kind]) => kind === "revoke")[1].where,
    { projectId: "mielno", userId: "leszek" });
  adminAllowed = false;
});

test("non-admin cannot grant project access", async () => {
  calls.length = 0; adminAllowed = false;
  await assert.rejects(
    () => new FinanceService().setProjectAccess("member", "mielno", "leszek", true),
    /Brak uprawnień administratora/);
  assert.equal(calls.some(([kind]) => kind === "grant"), false);
});

test("admin cannot grant to user outside active company membership", async () => {
  calls.length = 0; adminAllowed = true; targetAllowed = false;
  await assert.rejects(
    () => new FinanceService().setProjectAccess("admin", "mielno", "outsider", true),
    /Pracownik nie ma aktywnego dostępu/);
  assert.equal(calls.some(([kind]) => kind === "grant"), false);
  adminAllowed = false; targetAllowed = true;
});
