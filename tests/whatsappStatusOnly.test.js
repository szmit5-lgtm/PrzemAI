"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Module = require("node:module");

test("Meta status-only callback is acknowledged without writing a message", async () => {
  const routes = [];
  let writes = 0;
  const router = {
    use() {},
    get() {},
    post(path, ...handlers) { routes.push({ path, handler: handlers.at(-1) }); }
  };
  const prisma = {
    organization: { findFirst: async () => ({ id: "test-org" }) },
    whatsAppMessage: { create: async () => { writes++; } }
  };
  const originalLoad = Module._load;
  const originalEnv = {
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_ORGANIZATION_ID: process.env.WHATSAPP_ORGANIZATION_ID,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID
  };
  try {
    process.env.WHATSAPP_APP_SECRET = "test-secret";
    process.env.WHATSAPP_ORGANIZATION_ID = "test-org";
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
    const routePath = require.resolve("../api/routes/whatsappRoutes");
    delete require.cache[routePath];
    require(routePath);
    const handler = routes.find(x => x.path === "/webhook")?.handler;
    assert.equal(typeof handler, "function");
    const payload = { object: "whatsapp_business_account", entry: [
      { changes: [{ field: "messages", value: {
        metadata: { phone_number_id: "123456" },
        statuses: [{ id: "wamid.status1", status: "delivered" }]
      } }] }
    ] };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = "sha256=" + crypto.createHmac("sha256", "test-secret").update(rawBody).digest("hex");
    let statusCode;
    const res = { sendStatus(code) { statusCode = code; return this; } };
    await handler({ body: payload, rawBody, get: () => signature }, res);
    assert.equal(statusCode, 200);
    assert.equal(writes, 0);

    // Malformed callbacks must not be acknowledged or written to the database.
    const malformed = { object: "whatsapp_business_account", entry: [
      { changes: [{ field: "messages", value: {
        metadata: { phone_number_id: "123456" }
      } }] }
    ] };
    const malformedRaw = Buffer.from(JSON.stringify(malformed));
    const malformedSignature = "sha256=" +
      crypto.createHmac("sha256", "test-secret").update(malformedRaw).digest("hex");
    statusCode = undefined;
    await handler({
      body: malformed, rawBody: malformedRaw, get: () => malformedSignature
    }, res);
    assert.equal(statusCode, 503);
    assert.equal(writes, 0);

    // Reject unsigned or incorrectly signed deliveries before any DB lookup/write.
    statusCode = undefined;
    await handler({ body: payload, rawBody, get: () => "sha256=" + "0".repeat(64) }, res);
    assert.equal(statusCode, 403);
    assert.equal(writes, 0);
    delete require.cache[routePath];
  } finally {
    Module._load = originalLoad;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
