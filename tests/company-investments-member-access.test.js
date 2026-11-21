"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const serviceSource = fs.readFileSync(path.join(__dirname, "../api/services/OrganizationInvestmentService.js"), "utf8");
const routes = fs.readFileSync(path.join(__dirname, "../api/routes/organizationRoutes.js"), "utf8");
const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(path.join(__dirname, "../prisma/migrations/20261121120000_organization_investments/migration.sql"), "utf8");
const companyPage = fs.readFileSync(path.join(__dirname, "../frontend/src/app/company/[id]/page.js"), "utf8");
const investmentsPage = fs.readFileSync(path.join(__dirname, "../frontend/src/app/company/[id]/investments/page.js"), "utf8");

function harness(role = "MEMBER") {
  const calls = { memberships: [], reads: [], writes: [], mutations: [] };
  class OrganizationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  class OrganizationService {
    async membership(userId, organizationId, allowed = ["OWNER", "ADMIN", "MEMBER"]) {
      calls.memberships.push({ userId, organizationId, allowed });
      if (!allowed.includes(role) || role === "NONE") throw new OrganizationError("Brak dostępu do spółki", 403);
      return { userId, organizationId, role };
    }
  }
  const db = {
    organizationInvestment: {
      findMany: async params => { calls.reads.push(params); return [{ id: "inv1", name: "Mielno" }]; },
      create: async params => { calls.writes.push(params); return { id: "inv2", name: params.data.name }; },
      updateMany: async params => { calls.mutations.push(params); return { count: 1 }; },
      findFirst: async params => ({ id: params.where.id, organizationId: params.where.organizationId })
    }
  };
  const dependencies = {
    "../../lib/prisma": db,
    "./OrganizationService": { OrganizationService, OrganizationError }
  };
  const context = { module: { exports: {} }, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), "unexpected dependency: " + name);
    return dependencies[name];
  } };
  vm.runInNewContext(serviceSource, context, { filename: "OrganizationInvestmentService.js" });
  return { service: new context.module.exports.OrganizationInvestmentService({ db }), calls };
}

test("schema and migration store project data separately from finance and owner private projects", () => {
  assert.match(schema, /model OrganizationInvestment \{/);
  assert.match(schema, /@@unique\(\[organizationId, name\]\)/);
  assert.match(schema, /organizationId String/);
  assert.match(migration, /INSERT INTO "OrganizationInvestment"/);
  assert.match(migration, /'Mielno'/);
  assert.match(migration, /'Zgorzelec'/);
  assert.match(migration, /'NOT_SET', 'INITIAL_REFERENCE'/);
  assert.doesNotMatch(migration, /FinancialDocument/);
});

test("active MEMBER can list ONLY nonfinancial projects from their own organization", async () => {
  const { service, calls } = harness("MEMBER");
  const result = await service.list("leszek", "dekonica-org");
  assert.equal(result.scope, "ORGANIZATION_PROJECTS_ONLY");
  assert.equal(result.items.length, 1);
  assert.equal(calls.memberships[0].organizationId, "dekonica-org");
  assert.equal(calls.reads[0].where.organizationId, "dekonica-org");
  assert.equal(calls.reads[0].select.progress, true);
  assert.equal(calls.reads[0].select.financialDocuments, undefined);
});

test("nonmember is rejected before fetching any organization projects", async () => {
  const { service, calls } = harness("NONE");
  await assert.rejects(service.list("outsider", "dekonica-org"), err => err.status === 403);
  assert.equal(calls.reads.length, 0);
});

test("staff may read but cannot add or change investment records", async () => {
  const { service, calls } = harness("MEMBER");
  await assert.rejects(service.create("leszek", "org", { name: "Zgorzelec" }), err => err.status === 403);
  await assert.rejects(service.update("leszek", "org", "inv1", { status: "COMPLETED" }), err => err.status === 403);
  assert.equal(calls.writes.length, 0);
  assert.equal(calls.mutations.length, 0);
});

test("admin may add a project under correct organization; do not invent progress", async () => {
  const { service, calls } = harness("ADMIN");
  const row = await service.create("admin", "dekonica-org", { name: "  Zgorzelec ", description: " Zakres prac " });
  assert.equal(row.id, "inv2");
  assert.equal(calls.writes[0].data.organizationId, "dekonica-org");
  assert.equal(calls.writes[0].data.createdById, "admin");
  assert.equal(calls.writes[0].data.status, "NOT_SET");
  assert.equal(calls.writes[0].data.progress, undefined);
});

test("update filters BOTH project id and tenant id; arbitrary fields rejected", async () => {
  const { service, calls } = harness("OWNER");
  await service.update("owner", "dekonica-org", "inv1", { status: "IN_PROGRESS", progress: 75 });
  assert.equal(calls.mutations[0].where.organizationId, "dekonica-org");
  assert.equal(calls.mutations[0].where.id, "inv1");
  assert.equal(calls.mutations[0].data.progress, 75);
  await assert.rejects(service.update("owner", "dekonica-org", "inv1", { userId: "other" }), /Nieprawidłowe pola/);
  await assert.rejects(service.update("owner", "dekonica-org", "inv1", { progress: 103 }), /Postęp/);
  assert.equal(calls.mutations.length, 1);
});

test("API routing and workspace both expose company investments without finance permission", () => {
  assert.match(routes, /router\.get\("\/:id\/investments",verifyToken/);
  assert.match(routes, /router\.post\("\/:id\/investments",verifyToken/);
  assert.match(routes, /router\.patch\("\/:id\/investments\/:investmentId",verifyToken/);
  assert.match(companyPage, /href=\{"\/company\/"\+encodeURIComponent\(id\)\+"\/investments"\}/);
  assert.match(investmentsPage, /getOrganizationInvestments\(id\)/);
  assert.match(investmentsPage, /Wspólny widok inwestycji dla pracowników tej spółki/);
});
