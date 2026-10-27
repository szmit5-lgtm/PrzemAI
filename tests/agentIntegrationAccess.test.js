"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const integration = {
  id: "integration-1",
  userId: "user-1",
  type: "MAIL",
  provider: "HOME_PL",
  enabled: false,
  config: {
    email: "office@dekonica.com",
    passwordEnv: "DEKONICA_MAIL_PASSWORD",
    autoEnablePending: true
  }
};
const updates = [];
const prisma = {
  integration: {
    async findFirst({ where }) {
      return where.id === integration.id ? { ...integration, userId: where.userId } : null;
    },
    async update(query) {
      updates.push(query);
      return { ...integration, ...query.data };
    }
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent?.filename?.endsWith("/api/services/AgentService.js")) {
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

test("shared company mailbox cannot be enabled by an unauthorized user", async () => {
  const previous = process.env.DEKONICA_MAIL_OWNER_USER_ID;
  process.env.DEKONICA_MAIL_OWNER_USER_ID = "owner-1";
  updates.length = 0;
  try {
    await assert.rejects(
      new AgentService().setIntegrationEnabled("other-user", integration.id, true),
      /Brak uprawnień/
    );
    assert.equal(updates.length, 0);
  } finally {
    if (previous === undefined) delete process.env.DEKONICA_MAIL_OWNER_USER_ID;
    else process.env.DEKONICA_MAIL_OWNER_USER_ID = previous;
  }
});

test("authorized owner can enable the shared mailbox", async () => {
  const previous = process.env.DEKONICA_MAIL_OWNER_USER_ID;
  process.env.DEKONICA_MAIL_OWNER_USER_ID = "owner-1";
  updates.length = 0;
  try {
    await new AgentService().setIntegrationEnabled("owner-1", integration.id, true);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.enabled, true);
    assert.equal(updates[0].data.config.autoEnablePending, false);
  } finally {
    if (previous === undefined) delete process.env.DEKONICA_MAIL_OWNER_USER_ID;
    else process.env.DEKONICA_MAIL_OWNER_USER_ID = previous;
  }
});

test("an unauthorized user can still disable a legacy shared integration", async () => {
  const previous = process.env.DEKONICA_MAIL_OWNER_USER_ID;
  process.env.DEKONICA_MAIL_OWNER_USER_ID = "owner-1";
  updates.length = 0;
  try {
    await new AgentService().setIntegrationEnabled("other-user", integration.id, false);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.enabled, false);
  } finally {
    if (previous === undefined) delete process.env.DEKONICA_MAIL_OWNER_USER_ID;
    else process.env.DEKONICA_MAIL_OWNER_USER_ID = previous;
  }
});
