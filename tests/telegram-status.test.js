"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

const probes = [];
global.prisma = {
  history: {
    async findFirst({ where }) {
      probes.push(where);
      const field = where.report.path[0];
      if (field === "status") {
        if (where.userId === "owner") return { report: { telegramUserId: "424242" } };
        if (where.userId === "previous") return { report: { telegramUserId: "535353" } };
        return null;
      }
      return { userId: where.report.equals === "424242" ? "owner" : "other", report: { status: "LINKED" } };
    }
  }
};
const { accountStatus } = require("../api/services/TelegramBridgeService");
const router = require("../api/routes/telegramRoutes");

test("read-only diagnostics validate the caller's current link and return flags only", async () => {
  const env = {
    TELEGRAM_TOKEN: "token-that-must-not-leave",
    TELEGRAM_WEBHOOK_SECRET: "Webhook_Secret_fixture",
    TELEGRAM_WEBHOOK_AUTO_REGISTER: "true"
  };
  probes.length = 0;
  assert.deepEqual(await accountStatus({ userId: "owner", env }), {
    botConfigured: true, webhookSecretConfigured: true, automaticRegistrationEnabled: true, linked: true
  });
  assert.equal(probes[0].userId, "owner");
  assert.equal(probes[1].report.equals, "424242");
  assert.deepEqual(await accountStatus({ userId: "previous", env: { TELEGRAM_WEBHOOK_SECRET: "!".repeat(40) } }), {
    botConfigured: false, webhookSecretConfigured: false, automaticRegistrationEnabled: false, linked: false
  });
  probes.length = 0;
  assert.equal((await accountStatus({ userId: "unlinked", env })).linked, false);
  assert.equal(probes.length, 1);
});

test("Telegram status requires authentication and disallows caching", async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "unit-only-telegram-status";
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  const app = express();
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port + "/status";
  probes.length = 0;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, {
    headers: { Authorization: "Bearer " + jwt.sign({}, process.env.JWT_SECRET) }
  })).status, 401);
  assert.equal(probes.length, 0);
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + jwt.sign({ id: "owner" }, process.env.JWT_SECRET) }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const { data } = await response.json();
  assert.equal(data.linked, true);
  assert.ok(Object.values(data).every(value => typeof value === "boolean"));
});
