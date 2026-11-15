"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");

const routeSource = fs.readFileSync(
  path.join(__dirname, "../api/routes/whatsappRoutes.js"), "utf8"
);

function setup() {
  const postRoutes = new Map();
  const seen = new Set();
  const writes = [];
  const db = {
    organization: {
      async findFirst({ where }) {
        return where.id === "tenant-dekonica" && where.status === "ACTIVE"
          ? { id: where.id } : null;
      }
    },
    whatsAppMessage: {
      async create({ data }) {
        if (seen.has(data.externalMessageId)) throw { code: "P2002" };
        seen.add(data.externalMessageId);
        writes.push(data);
        return data;
      }
    }
  };
  const router = {
    use() { return this; },
    get() { return this; },
    post(route, ...callbacks) {
      postRoutes.set(route, callbacks.at(-1));
      return this;
    }
  };
  const deps = {
    express: { Router: () => router },
    crypto,
    "../../lib/prisma": db,
    "../middleware/verifyToken": (_req, _res, next) => next(),
    "../services/WhatsAppPolicy": { evaluateOutbound: () => ({ allowed: false }) }
  };
  const module = { exports: {} };
  vm.runInNewContext(routeSource, {
    module, exports: module.exports, Buffer,
    require(name) {
      if (!Object.hasOwn(deps, name)) throw new Error("Unexpected dependency: " + name);
      return deps[name];
    },
    process: { env: {
      WHATSAPP_APP_SECRET: "local-fixture-only",
      WHATSAPP_ORGANIZATION_ID: "tenant-dekonica",
      WHATSAPP_PHONE_NUMBER_ID: "phone-allowed"
    } },
    console: { error() {} }
  }, { filename: "whatsappRoutes.js" });

  async function deliver(payload, options = {}) {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = "sha256=" + crypto.createHmac("sha256", "local-fixture-only")
      .update(rawBody).digest("hex");
    const req = {
      body: payload, rawBody,
      get: () => options.signature === undefined ? sig : options.signature
    };
    const res = {
      code: null,
      sendStatus(code) { this.code = code; return this; },
      status(code) { this.code = code; return this; },
      json(value) { this.body = value; return this; }
    };
    await postRoutes.get("/webhook")(req, res);
    return res.code;
  }

  return { deliver, writes };
}

function payload(messages, numberId = "phone-allowed") {
  return {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        field: "messages",
        value: { metadata: { phone_number_id: numberId }, messages }
      }]
    }]
  };
}

const first = {
  id: "wamid.HBgLMjA2MzAwMDAwMDAwFQIAERgSQTFCMkMzRA",
  from: "48123456789",
  type: "text",
  timestamp: "1763155200",
  text: { body: "Wiadomość testowa" }
};

test("signed Meta message is persisted once with configured company and number", async () => {
  const { deliver, writes } = setup();
  assert.equal(await deliver(payload([first])), 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].organizationId, "tenant-dekonica");
  assert.equal(writes[0].phoneNumberId, "phone-allowed");
  assert.equal(writes[0].contactWaId, "48123456789");
  assert.equal(writes[0].text, "Wiadomość testowa");
  assert.equal(writes[0].externalMessageId, first.id);
});

test("repeated delivery is acknowledged without saving another message", async () => {
  const { deliver, writes } = setup();
  assert.equal(await deliver(payload([first])), 200);
  assert.equal(await deliver(payload([first])), 200);
  assert.equal(writes.length, 1);
});

test("invalid webhook signature never reaches persistence", async () => {
  const { deliver, writes } = setup();
  assert.equal(await deliver(payload([first]), { signature: "sha256=" + "0".repeat(64) }), 403);
  assert.equal(writes.length, 0);
});

test("malformed message causes retry instead of silent acknowledgement", async () => {
  const { deliver, writes } = setup();
  const malformed = { ...first, id: "invalid", from: "invalid" };
  assert.equal(await deliver(payload([malformed])), 503);
  assert.equal(writes.length, 0);
});

test("another Meta phone number cannot write into Dekonica tenant", async () => {
  const { deliver, writes } = setup();
  assert.equal(await deliver(payload([first], "phone-other")), 200);
  assert.equal(writes.length, 0);
});

test("a malformed later message cannot partially persist an earlier valid one", async () => {
  const { deliver, writes } = setup();
  assert.equal(await deliver(payload([first, { ...first, from: "bad-number" }])), 503);
  assert.equal(writes.length, 0);
});


test("Meta status-only delivery is acknowledged without database writes", async () => {
  const { deliver, writes } = setup();
  const statusPayload = {
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: "phone-allowed" },
      statuses: [{ id: first.id, status: "delivered" }]
    } }] }]
  };
  assert.equal(await deliver(statusPayload), 200);
  assert.equal(writes.length, 0);
});

test("malformed callback missing both messages and status data is retried", async () => {
  const { deliver, writes } = setup();
  const badPayload = {
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: "phone-allowed" }
    } }] }]
  };
  assert.equal(await deliver(badPayload), 503);
  assert.equal(writes.length, 0);
});
