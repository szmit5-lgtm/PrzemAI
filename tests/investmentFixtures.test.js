"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createInvestmentFixtures, listTenantInvestments } = require("../lib/investmentFixtures");
test("three synthetic investments, fifteen tasks and three protocols", () => {
  const data = createInvestmentFixtures();
  assert.deepEqual(data.projects.map((x) => x.name), ["Mielno", "Zgorzelec", "Barwice"]);
  assert.equal(data.tasks.length, 15);
  assert.equal(data.protocols.length, 3);
  assert.ok([...data.projects, ...data.tasks, ...data.protocols].every((x) => x.synthetic === true));
});
test("tenant-filtered investment data never leaks another organization's records", () => {
  const a = createInvestmentFixtures("tenant-demo-a");
  const b = createInvestmentFixtures("tenant-demo-b");
  const all = { projects: [...a.projects, ...b.projects], tasks: [...a.tasks, ...b.tasks], protocols: [...a.protocols, ...b.protocols] };
  const visible = listTenantInvestments(all, "tenant-demo-b");
  assert.equal(visible.projects.length, 3);
  assert.equal(visible.tasks.length, 15);
  assert.equal(visible.protocols.length, 3);
  assert.ok([...visible.projects, ...visible.tasks, ...visible.protocols].every((x) => x.organizationId === "tenant-demo-b"));
  assert.equal(listTenantInvestments(all, "tenant-unknown").projects.length, 0);
});
test("reject non-synthetic organization identifiers", () => {
  assert.throws(() => createInvestmentFixtures("real-org-123"), /synthetic/);
});
