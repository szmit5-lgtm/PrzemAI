"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../api/routes/whatsappRoutes.js"), "utf8");

function start() {
  const routes = {};
  const calls = { member: [], inbox: [], contacts: [], last: [], outbound: 0 };
  const db = {
    organizationMembership: {
      async findFirst({ where }) {
        calls.member.push(where);
        if (where.organizationId === "dekonica" && where.userId === "owner" &&
            where.status === "ACTIVE") return { id: "membership" };
        return null;
      }
    },
    whatsAppMessage: {
      async findMany(args) { calls.inbox.push(args); return []; },
      async groupBy(args) { calls.contacts.push(args); return []; },
      async findFirst(args) {
        calls.last.push(args);
        return { id: "last-inbound", receivedAt: new Date(0) };
      }
    }
  };
  const router = {
    use() { return this; },
    get(key, ...handlers) { routes["GET " + key] = handlers.at(-1); return this; },
    post(key, ...handlers) { routes["POST " + key] = handlers.at(-1); return this; }
  };
  const dependencies = {
    express: { Router: () => router },
    crypto: require("node:crypto"),
    "../../lib/prisma": db,
    "../middleware/verifyToken": (_req, _res, next) => next(),
    "../services/WhatsAppPolicy": {
      evaluateOutbound() { calls.outbound++; return { allowed: false }; }
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module, exports: module.exports, Buffer,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected import " + name);
      return dependencies[name];
    },
    console: { error() {} },
    process: { env: {} }
  }, { filename: "whatsappRoutes.js" });

  async function invoke(method, key, { organizationId = "dekonica", userId = "owner",
    query = {}, body = {} } = {}) {
    const response = {
      code: 200, payload: null,
      status(n) { this.code = n; return this; },
      sendStatus(n) { this.code = n; return this; },
      json(v) { this.payload = v; return this; }
    };
    const handler = routes[method + " " + key];
    assert.equal(typeof handler, "function", key + " route missing");
    await handler({
      params: { organizationId }, user: { id: userId }, query, body
    }, response);
    return response;
  }
  return { invoke, calls, routes };
}

test("WhatsApp inbox rejects user without active membership before reading messages", async () => {
  const { invoke, calls } = start();
  for (const options of [
    { organizationId: "dekonica", userId: "intruder" },
    { organizationId: "other-company", userId: "owner" }
  ]) {
    const res = await invoke("GET", "/organizations/:organizationId/messages", options);
    assert.equal(res.code, 403);
  }
  assert.equal(calls.inbox.length, 0);
  assert.equal(calls.member.length, 2);
});

test("authorized inbox query is always constrained by server-approved organization", async () => {
  const { invoke, calls } = start();
  const res = await invoke("GET", "/organizations/:organizationId/messages", {
    query: { contact: "48123456789", limit: "999", organizationId: "other-company" }
  });
  assert.equal(res.code, 200);
  assert.equal(calls.inbox.length, 1);
  assert.equal(calls.inbox[0].where.organizationId, "dekonica");
  assert.equal(calls.inbox[0].where.contactWaId, "48123456789");
  assert.equal(calls.inbox[0].take, 100);
});

test("conversations endpoint refuses nonmembers without grouping private messages", async () => {
  const { invoke, calls } = start();
  assert.equal((await invoke("GET", "/organizations/:organizationId/conversations", {
    userId: "intruder"
  })).code, 403);
  assert.equal(calls.contacts.length, 0);
  assert.equal((await invoke("GET", "/organizations/:organizationId/conversations")).code, 200);
  assert.equal(calls.contacts.length, 1);
  assert.equal(calls.contacts[0].where.organizationId, "dekonica");
});

test("draft is tenant-bound, policy-paused, and has no send side effect", async () => {
  const { invoke, calls, routes } = start();
  const key = "/organizations/:organizationId/draft-preview";
  const options = { body: { contactWaId: "48123456789" } };
  assert.equal((await invoke("POST", key, { ...options, userId: "intruder" })).code, 403);
  assert.equal(calls.last.length, 0);
  const result = await invoke("POST", key, options);
  assert.equal(result.code, 200);
  assert.equal(result.payload.requiresHumanApproval, true);
  assert.equal(result.payload.sent, false);
  assert.equal(result.payload.policy.allowed, false);
  assert.equal(calls.last[0].where.organizationId, "dekonica");
  assert.equal(calls.last[0].where.contactWaId, "48123456789");
  assert.equal(calls.last[0].where.direction, "INBOUND");
  assert.equal(calls.outbound, 1);
  assert.equal(Object.keys(routes).some(k => /send-message|send-outbound|send-to-meta/i.test(k)), false);
});
