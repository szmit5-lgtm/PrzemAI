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
