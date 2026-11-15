"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Module = require("node:module");

test("signed Meta status-only webhook returns 200 without a message write", async () => {
  const routes = [];
  let writes = 0;
  const router = {
    use() {}, get() {},
    post(path, ...handlers) { routes.push({ path, handler: handlers.at(-1) }); }
  };
  const prisma = {
    organization: { findFirst: async () => ({ id: "fixture-org" }) },
    whatsAppMessage: { create: async () => { writes++; } }
  };
  const envKeys = ["WHATSAPP_APP_SECRET", "WHATSAPP_ORGANIZATION_ID", "WHATSAPP_PHONE_NUMBER_ID"];
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const originalLoad = Module._load;
  const routePath = require.resolve("../api/routes/whatsappRoutes");
  try {
    process.env.WHATSAPP_APP_SECRET = "fixture-secret";
    process.env.WHATSAPP_ORGANIZATION_ID = "fixture-org";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    Module._load = function (request, parent, isMain) {
      if (parent?.filename?.endsWith("/api/routes/whatsappRoutes.js")) {
        if (request === "express") return { Router: () => router };
        if (request === "../../lib/prisma") return prisma;
        if (request === "../middleware/verifyToken") return (_req, _res, next) => next();
        if (request === "../services/WhatsAppPolicy") return { evaluateOutbound: () => ({ decision: "deny" }) };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[routePath];
    require(routePath);
    const handler = routes.find(route => route.path === "/webhook")?.handler;
    assert.equal(typeof handler, "function");
    const payload = { object: "whatsapp_business_account", entry: [
      { changes: [{ field: "messages", value: {
        metadata: { phone_number_id: "123456" },
        statuses: [{ id: "wamid.fixture", status: "delivered" }]
      } }] }
    ] };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = "sha256=" + crypto.createHmac("sha256", "fixture-secret").update(rawBody).digest("hex");
    let status;
    await handler({ body: payload, rawBody, get: () => signature }, {
      sendStatus(code) { status = code; return this; }
    });
    assert.equal(status, 200);
    assert.equal(writes, 0);
  } finally {
    delete require.cache[routePath];
    Module._load = originalLoad;
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
