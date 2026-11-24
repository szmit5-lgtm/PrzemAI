"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { OrganizationInvestmentService } = require("../api/services/OrganizationInvestmentService");
const { OrganizationError } = require("../api/services/OrganizationService");

function setup(activeIds = ["leszek"]) {
  let assigned = null;
  const db = {
    organizationMembership: {
      findMany: async ({ where }) => where.userId.in
        .filter(id => activeIds.includes(id)).map(userId => ({ userId }))
    },
    organizationInvestment: {
      updateMany: async ({ where, data }) => {
        if (where.organizationId !== "dekonica" || where.id !== "mielno") return { count: 0 };
        assigned = data.assignedUserIds;
        return { count: 1 };
      },
      findFirst: async () => ({ id: "mielno", organizationId: "dekonica", assignedUserIds: assigned })
    }
  };
  const orgService = { membership: async (_user, _org, roles) => {
    assert.deepEqual(roles, ["OWNER", "ADMIN"]);
  }};
  return { service: new OrganizationInvestmentService({ db, orgService }), getAssigned: () => assigned };
}
test("owner can assign active company member", async () => {
  const { service, getAssigned } = setup();
  const row = await service.assignMembers("owner", "dekonica", "mielno", { userIds: ["leszek"] });
  assert.deepEqual(row.assignedUserIds, ["leszek"]);
  assert.deepEqual(getAssigned(), ["leszek"]);
});
test("cannot assign member outside company", async () => {
  const { service, getAssigned } = setup();
  await assert.rejects(service.assignMembers("owner", "dekonica", "mielno", { userIds: ["outsider"] }), e => e instanceof OrganizationError && e.status === 403);
  assert.equal(getAssigned(), null);
});
test("cannot assign duplicate IDs or change another company investment", async () => {
  const { service } = setup();
  await assert.rejects(service.assignMembers("owner", "dekonica", "mielno", { userIds: ["leszek", "leszek"] }));
  await assert.rejects(service.assignMembers("owner", "dekonica", "other-project", { userIds: ["leszek"] }), e => e.status === 404);
});
test("can clear assignments", async () => {
  const { service } = setup();
  const row = await service.assignMembers("owner", "dekonica", "mielno", { userIds: [] });
  assert.deepEqual(row.assignedUserIds, []);
});

test("regular member sees only explicitly assigned investments in their company", async () => {
  let where;
  let select;
  const db = { organizationInvestment: { findMany: async query => {
    where = query.where;
    select = query.select;
    return [{ id: "mielno" }];
  } } };
  const orgService = { membership: async () => ({ role: "MEMBER" }) };
  const service = new OrganizationInvestmentService({ db, orgService });
  const result = await service.list("leszek", "dekonica");
  assert.deepEqual(where, { organizationId: "dekonica", assignedUserIds: { has: "leszek" } });
  assert.equal(select.assignedUserIds, undefined, "Prisma select must not mix true and false");
  assert.ok(Object.values(select).every(value => value === true), "Prisma select must contain only included fields");
  assert.equal(result.items.length, 1);
});
test("owner can still list all company investments without assignment filter", async () => {
  let where;
  const db = { organizationInvestment: { findMany: async query => {
    where = query.where;
    return [];
  } } };
  const orgService = { membership: async () => ({ role: "OWNER" }) };
  const service = new OrganizationInvestmentService({ db, orgService });
  await service.list("owner", "dekonica");
  assert.deepEqual(where, { organizationId: "dekonica" });
});

test("admin may assign active members, but an unauthorized member is rejected before database writes", async () => {
  const { service } = setup(["leszek"]);
  await service.assignMembers("admin", "dekonica", "mielno", { userIds: ["leszek"] });
  let touched = false;
  const db = { organizationMembership: { findMany: async () => { touched = true; return []; } } };
  const orgService = { membership: async () => { throw new OrganizationError("Brak uprawnień.", 403); } };
  const denied = new OrganizationInvestmentService({ db, orgService });
  await assert.rejects(
    denied.assignMembers("member", "dekonica", "mielno", { userIds: ["leszek"] }),
    error => error instanceof OrganizationError && error.status === 403
  );
  assert.equal(touched, false);
});
