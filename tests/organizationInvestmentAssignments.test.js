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
