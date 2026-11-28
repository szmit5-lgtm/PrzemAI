"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");

async function main() {
  const dbUrl = new URL(process.env.DATABASE_URL);
  assert.equal(dbUrl.protocol, "postgresql:");
  assert.equal(dbUrl.hostname, "127.0.0.1");
  assert.match(dbUrl.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);

  process.env.JWT_SECRET = randomUUID();
  const express = require("express");
  const jwt = require("jsonwebtoken");
  const db = require("../lib/prisma");
  const app = express();
  app.use(express.json());
  app.use("/api/workspace", require("../api/routes/workspaceToolsRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port + "/api/workspace";
  const userIds = [];
  const companyIds = [];

  const headersFor = user => ({
    cookie: "__Host-przemai-session=" + jwt.sign({ id: user.id }, process.env.JWT_SECRET),
    "sec-fetch-site": "same-origin",
    "Content-Type": "application/json"
  });
  const search = (user, query, organizationId, headers = headersFor(user)) =>
    fetch(base + "/search", { method: "POST", headers, body: JSON.stringify({ query, organizationId }) });

  try {
    for (const name of ["owner", "leszek"]) {
      const user = await db.user.create({
        data: { email: name + "-" + randomUUID() + "@example.test", password: "synthetic-password-hash" }
      });
      userIds.push(user.id);
    }
    const [owner, employee] = userIds.map(id => ({ id }));

    for (const name of ["Dekonica", "Deherus"]) {
      const company = await db.organization.create({
        data: {
          name, slug: name.toLowerCase() + "-" + randomUUID(),
          memberships: { create: [
            { userId: owner.id, role: "OWNER" },
            ...(name === "Dekonica" ? [{ userId: employee.id }] : [])
          ] }
        }
      });
      companyIds.push(company.id);
    }
    const [dekonica, deherus] = companyIds;
    for (const [name, organizationId, assignedUserIds] of [
      ["Inwestycja Mielno", dekonica, [employee.id]],
      ["Inwestycja Zgorzelec", dekonica, []],
      ["Inwestycja Deherus", deherus, [employee.id]]
    ]) {
      await db.organizationInvestment.create({ data: { name, organizationId, assignedUserIds } });
    }
    await db.organizationDocument.create({ data: {
      organizationId: dekonica, name: "Inwestycja dokument.txt", contentType: "text/plain",
      content: Buffer.from("test"), sha256: "a".repeat(64), size: 4
    } });
    await db.history.createMany({ data: [
      { title: "Plan Mielno 100%", type: "document", userId: employee.id },
      { title: "Plan Mielno 1000", type: "meeting", userId: employee.id },
      { title: "Plan obcy 100%", type: "document", userId: owner.id },
      { title: "Plan wewnętrzny 100%", type: "internal", userId: employee.id }
    ].map(row => ({ ...row, filename: "synthetic.txt", report: { secret: "internal-test-value" } })) });
    await db.task.createMany({ data: [
      { title: "Plan prywatny", userId: employee.id },
      { title: "Plan firmowy", userId: employee.id, source: "COMPANY" },
      { title: "Plan inwestycji usuniętej", userId: employee.id, investmentScoped: true }
    ] });

    assert.equal((await search(employee, "Plan", undefined, {})).status, 401);
    assert.equal((await search(employee, "Plan", undefined, {
      ...headersFor(employee), "sec-fetch-site": "cross-site"
    })).status, 403);
    assert.equal((await search(employee, "ab")).status, 400);
    assert.equal((await search(employee, "Inwestycja", deherus)).status, 403);

    const employeeResults = await (await search(employee, "inwestycja", dekonica)).json();
    assert.deepEqual(employeeResults.results.map(row => row.title), ["Inwestycja Mielno"]);
    const ownerResults = await (await search(owner, "Inwestycja", dekonica)).json();
    assert.deepEqual(ownerResults.results.map(row => row.title).sort(), [
      "Inwestycja Mielno", "Inwestycja Zgorzelec", "Inwestycja dokument.txt"
    ]);
    const literal = await (await search(employee, "100%")).json();
    assert.deepEqual(literal.results.map(row => row.title), ["Plan Mielno 100%"]);

    await db.history.createMany({ data: Array.from({ length: 510 }, (_, index) => ({
      title: "Seria " + index, type: "document", userId: employee.id, filename: "synthetic.txt", report: {}
    })) });
    const limited = await (await search(employee, "Seria")).json();
    assert.equal(limited.results.length, 12);
    assert.equal(limited.hasMore, true);

    const exported = await fetch(base + "/personal-export", { headers: headersFor(employee) });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get("cache-control"), /no-store/);
    assert.match(exported.headers.get("content-disposition"), /attachment/);
    const archive = await exported.json();
    assert.equal(archive.account.id, employee.id);
    assert.equal(archive.account.password, undefined);
    assert.deepEqual(archive.tasks.map(row => row.title), ["Plan prywatny"]);
    assert.equal(archive.history.length, 500);
    assert.deepEqual(archive.truncatedSections, ["history"]);
    assert.ok(archive.history.every(row => row.report === undefined));
    console.log("Workspace E2E OK: session, CSRF, tenant roles, assigned investments, literal search, bounds and personal export");
  } finally {
    await new Promise(resolve => server.close(resolve));
    try {
      await db.organization.deleteMany({ where: { id: { in: companyIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await db.$disconnect();
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
