"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { isAuthorizedDekonicaUser, canSyncMailIntegration } =
  require("../lib/mailAccessPolicy");
const mailDocumentId = require("../lib/mailDocumentId");

test("shared mailbox is denied without an explicit owner ID", () => {
  const integration = {
    type: "MAIL", provider: "HOME_PL",
    config: { email: "office@dekonica.com", passwordEnv: "DEKONICA_MAIL_PASSWORD" }
  };
  assert.equal(isAuthorizedDekonicaUser("user-a", {}), false);
  assert.equal(canSyncMailIntegration("user-a", integration, {}), false);
  assert.equal(canSyncMailIntegration("user-b", integration, { DEKONICA_MAIL_OWNER_USER_ID: "user-a" }), false);
  assert.equal(canSyncMailIntegration("user-a", integration, { DEKONICA_MAIL_OWNER_USER_ID: "user-a" }), true);
});

test("shared mailbox policy rejects partial and case-mismatched configurations", () => {
  const env = { DEKONICA_MAIL_OWNER_USER_ID: "user-a" };
  const base = { type: "MAIL", provider: "HOME_PL" };
  assert.equal(canSyncMailIntegration("user-a", {
    ...base, config: { email: "OFFICE@DEKONICA.COM ", passwordEnv: "OTHER_PASSWORD" }
  }, env), false);
  assert.equal(canSyncMailIntegration("user-a", {
    ...base, config: { email: "other@example.com", passwordEnv: "DEKONICA_MAIL_PASSWORD" }
  }, env), false);
  assert.equal(canSyncMailIntegration("user-a", {
    ...base, config: { email: " OFFICE@DEKONICA.COM ", passwordEnv: "DEKONICA_MAIL_PASSWORD" }
  }, env), true);
  assert.equal(canSyncMailIntegration("user-a", { type: "KSEF", provider: "HOME_PL", config: {} }, env), false);
});

test("mail attachment identity is deterministic and collision-resistant across indexes", () => {
  const base = { integrationId: "integration-1", messageId: "<message@example.com>", uid: 7, uidValidity: 99, filename: "invoice.pdf", attachmentIndex: 0 };
  const a = mailDocumentId(base);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, mailDocumentId({ ...base }));
  assert.notEqual(a, mailDocumentId({ ...base, attachmentIndex: 1 }));
  assert.notEqual(a, mailDocumentId({ ...base, integrationId: "integration-2" }));
  assert.notEqual(a, mailDocumentId({ ...base, filename: "another.pdf" }));
  assert.throws(() => mailDocumentId({ ...base, attachmentIndex: -1 }));
  assert.throws(() => mailDocumentId({ ...base, messageId: "", uid: null }));
});

// Isolate AgentService from the database; verify the status lock with no writes.
const prisma = { agent: {} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/api/services/AgentService.js")) {
    if (request === "../../lib/prisma") return prisma;
    if (request === "../../core/agents/AgentRunner") return class AgentRunner {};
  }
  return originalLoad.call(this, request, parent, isMain);
};
let AgentService;
try {
  AgentService = require("../api/services/AgentService");
} finally {
  Module._load = originalLoad;
}

test("agent settings cannot invalidate a RUNNING lock", async () => {
  let updateQuery;
  prisma.agent.findFirst = async () => ({ id: "agent-1", userId: "user-1", status: "RUNNING" });
  prisma.agent.updateMany = async args => {
    updateQuery = args;
    return { count: 0 };
  };
  prisma.agent.findUnique = async () => { throw new Error("should not read"); };
  const service = new AgentService();
  await assert.rejects(() => service.setEnabled("user-1", "agent-1", false), /podczas jego pracy/);
  assert.deepEqual(updateQuery.where, {
    id: "agent-1", userId: "user-1", NOT: { status: "RUNNING" }
  });
});

test("agent settings update atomically for an idle owned agent", async () => {
  let updateQuery;
  prisma.agent.findFirst = async () => ({ id: "agent-1", userId: "user-1", status: "IDLE" });
  prisma.agent.updateMany = async args => { updateQuery = args; return { count: 1 }; };
  prisma.agent.findUnique = async () => ({ id: "agent-1", enabled: false, status: "DISABLED" });
  const service = new AgentService();
  const result = await service.setEnabled("user-1", "agent-1", false);
  assert.equal(updateQuery.data.enabled, false);
  assert.equal(updateQuery.data.status, "DISABLED");
  assert.equal(updateQuery.data.nextRunAt, null);
  assert.equal(result.status, "DISABLED");
});

test("agent settings reject access to another user's agent", async () => {
  prisma.agent.findFirst = async () => null;
  prisma.agent.updateMany = async () => { throw new Error("unauthorized update"); };
  const service = new AgentService();
  await assert.rejects(() => service.setEnabled("user-2", "agent-1", true), /Agent nie istnieje/);
});


test("agent toggles reject non-boolean values before any database access", async () => {
  prisma.agent.findFirst = async () => { throw new Error("unexpected database access"); };
  const service = new AgentService();
  for (const invalid of ["false", "true", 0, 1, null, undefined, {}, []]) {
    await assert.rejects(
      () => service.setEnabled("user-1", "agent-1", invalid),
      /enabled musi mieć wartość true lub false/
    );
  }
});

test("mail integration toggles reject truthy strings and other invalid values", async () => {
  prisma.integration = {
    findFirst: async () => { throw new Error("unexpected database access"); }
  };
  const service = new AgentService();
  for (const invalid of ["false", "true", 0, 1, null, undefined, {}, []]) {
    await assert.rejects(
      () => service.setIntegrationEnabled("user-1", "integration-1", invalid),
      /enabled musi mieć wartość true lub false/
    );
  }
});
