"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { requireKsefOrganizationAccess } = require("../lib/ksefOrganizationAccess");

const membership = { id: "m1", organizationId: "dekonica", role: "ADMIN" };

test("grants access only to active members of active organizations", async () => {
  let where;
  const prisma = { organizationMembership: { findFirst: async query => {
    where = query.where;
    return membership;
  } } };
  assert.deepEqual(await requireKsefOrganizationAccess({ prisma, organizationId: "dekonica", userId: "u1" }), membership);
  assert.deepEqual(where, {
    organizationId: "dekonica", userId: "u1", status: "ACTIVE",
    organization: { status: "ACTIVE" }, role: { in: ["OWNER", "ADMIN", "MEMBER"] }
  });
});

test("denies nonmembers", async () => {
  const prisma = { organizationMembership: { findFirst: async () => null } };
  await assert.rejects(requireKsefOrganizationAccess({ prisma, organizationId: "dekonica", userId: "stranger" }), /access denied/);
});

test("denies missing identity before querying database", async () => {
  let calls = 0;
  const prisma = { organizationMembership: { findFirst: async () => { calls++; return membership; } } };
  await assert.rejects(requireKsefOrganizationAccess({ prisma, organizationId: "dekonica" }), /access denied/);
  await assert.rejects(requireKsefOrganizationAccess({ prisma, userId: "u1" }), /access denied/);
  assert.equal(calls, 0);
});

test("restricts integration management to organization admins", async () => {
  let roles;
  const prisma = { organizationMembership: { findFirst: async ({ where }) => {
    roles = where.role.in;
    return null;
  } } };
  await assert.rejects(requireKsefOrganizationAccess({ prisma, organizationId: "dekonica", userId: "member", allowedRoles: ["OWNER", "ADMIN"] }), /access denied/);
  assert.deepEqual(roles, ["OWNER", "ADMIN"]);
});

test("rejects cross-organization membership returned by database", async () => {
  const prisma = { organizationMembership: { findFirst: async () => ({
    id: "m2", organizationId: "other-company", role: "ADMIN"
  }) } };
  await assert.rejects(requireKsefOrganizationAccess({
    prisma, organizationId: "dekonica", userId: "u1"
  }), /access denied/);
});

test("rejects membership role outside requested administrative roles", async () => {
  const prisma = { organizationMembership: { findFirst: async () => ({
    id: "m3", organizationId: "dekonica", role: "MEMBER"
  }) } };
  await assert.rejects(requireKsefOrganizationAccess({
    prisma, organizationId: "dekonica", userId: "u1", allowedRoles: ["OWNER", "ADMIN"]
  }), /access denied/);
});

test("rejects malformed identifiers and roles without querying database", async () => {
  let calls = 0;
  const prisma = { organizationMembership: { findFirst: async () => { calls++; return membership; } } };
  for (const args of [
    { organizationId: " dekonica", userId: "u1" },
    { organizationId: "dekonica", userId: "u1 " },
    { organizationId: "dekonica", userId: "u1", allowedRoles: [] },
    { organizationId: "dekonica", userId: "u1", allowedRoles: ["ADMIN", "SUPERUSER"] }
  ]) {
    await assert.rejects(requireKsefOrganizationAccess({ prisma, ...args }), /access denied/);
  }
  assert.equal(calls, 0);
});

test("denies absent Prisma client without a database call", async () => {
  await assert.rejects(requireKsefOrganizationAccess({
    organizationId: "dekonica", userId: "u1"
  }), /access denied/);
});

test("does not turn database errors into authorization grants", async () => {
  const prisma = { organizationMembership: { findFirst: async () => {
    throw new Error("database unavailable");
  } } };
  await assert.rejects(requireKsefOrganizationAccess({
    prisma, organizationId: "dekonica", userId: "u1"
  }), /database unavailable/);
});

test("permits a regular member to read when membership is valid", async () => {
  const member = { id: "m4", organizationId: "dekonica", role: "MEMBER" };
  const prisma = { organizationMembership: { findFirst: async () => member } };
  assert.deepEqual(await requireKsefOrganizationAccess({
    prisma, organizationId: "dekonica", userId: "u1"
  }), member);
});
