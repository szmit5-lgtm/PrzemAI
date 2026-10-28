"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let existingIntegration = null;
let createdIntegration = null;
let updatedIntegration = null;

const prisma = {
  agent: { async upsert() { return {}; } },
  integration: {
    async findFirst() { return existingIntegration; },
    async create({ data }) {
      createdIntegration = data;
      return data;
    },
    async update({ data }) {
      updatedIntegration = data;
      return data;
    }
  }
};

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

function withOwner(callback) {
  const oldOwner = process.env.DEKONICA_MAIL_OWNER_USER_ID;
  const oldPassword = process.env.DEKONICA_MAIL_PASSWORD;
  process.env.DEKONICA_MAIL_OWNER_USER_ID = "test-owner";
  process.env.DEKONICA_MAIL_PASSWORD = "dummy-secret-not-real";
  return Promise.resolve().then(callback).finally(() => {
    if (oldOwner === undefined) delete process.env.DEKONICA_MAIL_OWNER_USER_ID;
    else process.env.DEKONICA_MAIL_OWNER_USER_ID = oldOwner;
    if (oldPassword === undefined) delete process.env.DEKONICA_MAIL_PASSWORD;
    else process.env.DEKONICA_MAIL_PASSWORD = oldPassword;
  });
}

test("shared mailbox stays disabled even when owner and secret are configured", async () => {
  await withOwner(async () => {
    existingIntegration = null;
    createdIntegration = null;
    await new AgentService().ensureDefaults("test-owner");
    assert.equal(createdIntegration.enabled, false);
    assert.equal(createdIntegration.config.passwordEnv, "DEKONICA_MAIL_PASSWORD");
    assert.equal(createdIntegration.config.autoEnablePending, undefined);
    assert.equal(Object.hasOwn(createdIntegration.config, "password"), false);
  });
});

test("legacy pending mailbox is migrated without activating synchronization", async () => {
  await withOwner(async () => {
    existingIntegration = {
      id: "integration-test",
      enabled: false,
      config: {
        email: "office@dekonica.com",
        passwordEnv: "DEKONICA_MAIL_PASSWORD",
        autoEnablePending: true
      }
    };
    updatedIntegration = null;
    await new AgentService().ensureDefaults("test-owner");
    assert.equal(updatedIntegration.enabled, false);
    assert.equal(updatedIntegration.config.autoEnablePending, false);
  });
});

test("explicitly disabled mailbox is not re-enabled by ensureDefaults", async () => {
  await withOwner(async () => {
    existingIntegration = {
      id: "integration-test",
      enabled: false,
      config: {
        email: "office@dekonica.com",
        passwordEnv: "DEKONICA_MAIL_PASSWORD",
        autoEnablePending: false
      }
    };
    updatedIntegration = null;
    await new AgentService().ensureDefaults("test-owner");
    assert.equal(updatedIntegration, null);
  });
});
