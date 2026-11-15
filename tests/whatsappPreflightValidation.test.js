"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Module = require("node:module");

test("signed valid Meta message passes preflight and persists once", async () => {
  const originalLoad = Module._load;
  const keys = ["WHATSAPP_APP_SECRET", "WHATSAPP_ORGANIZATION_ID", "WHATSAPP_PHONE_NUMBER_ID"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const routes = [];
  const saved = [];
  const router = {
    use() {}, get() {},
    post(path, ...handlers) { routes.push([path, handlers.at(-1)]); }
  };
  const routePath = require.resolve("../api/routes/whatsappRoutes");
  try {
    process.env.WHATSAPP_APP_SECRET = "synthetic-test-secret";
    process.env.WHATSAPP_ORGANIZATION_ID = "synthetic-org";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    Module._load = function (request, parent, isMain) {
      if (parent?.filename === routePath) {
        if (request === "express") return { Router: () => router };
        if (request === "../../lib/prisma") return {
          organization: { findFirst: async () => ({ id: "synthetic-org" }) },
          whatsAppMessage: { create: async ({ data }) => saved.push(data) }
        };
        if (request === "../middleware/verifyToken") return (_req, _res, next) => next();
        if (request === "../services/WhatsAppPolicy") return { evaluateOutbound: () => ({ decision: "deny" }) };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[routePath];
    require(routePath);
    const handler = routes.find(([path]) => path === "/webhook")?.[1];
    assert.equal(typeof handler, "function");
    const body = { object: "whatsapp_business_account", entry: [
      { changes: [{ field: "messages", value: {
        metadata: { phone_number_id: "123456" },
        messages: [{ id: "wamid.synthetic-123", from: "48123456789",
          type: "text", text: { body: "Synthetic test" } }]
      } }] }
    ] };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = "sha256=" + crypto.createHmac("sha256", "synthetic-test-secret")
      .update(rawBody).digest("hex");
    let code;
    await handler({ body, rawBody, get: () => signature }, {
      sendStatus(value) { code = value; return this; }
    });
    assert.equal(code, 200);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].organizationId, "synthetic-org");
    assert.equal(saved[0].externalMessageId, "wamid.synthetic-123");
  } finally {
    Module._load = originalLoad;
    delete require.cache[routePath];
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
