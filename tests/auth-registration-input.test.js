"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// Exercise the controller without creating users or connecting to a database.
const originalLoad = Module._load;
let databaseCalls = 0;
let AuthController;
try {
  Module._load = function (request, parent, isMain) {
    if (request === "jsonwebtoken") return { sign: () => "unused" };
    if (request === "../../lib/prisma") return {
      user: {
        findUnique: async () => { databaseCalls++; throw new Error("unexpected database access"); },
        create: async () => { databaseCalls++; throw new Error("unexpected database access"); }
      }
    };
    if (request === "../../lib/hash") return {
      hashPassword: async () => { throw new Error("unexpected password hashing"); },
      comparePassword: async () => false
    };
    return originalLoad.apply(this, arguments);
  };
  AuthController = require("../api/controllers/AuthController");
} finally {
  Module._load = originalLoad;
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test("registration rejects malformed JSON payloads without accessing the database", async (t) => {
  const originalSetting = process.env.ALLOW_PUBLIC_REGISTRATION;
  delete process.env.ALLOW_PUBLIC_REGISTRATION;
  try {
    for (const [label, body] of [
      ["missing body", undefined],
      ["null body", null],
      ["array email", { email: ["test@example.com"], password: "validpassword" }],
      ["numeric password", { email: "test@example.com", password: 12345678 }],
      ["missing password", { email: "test@example.com" }],
      ["blank email", { email: "   ", password: "validpassword" }]
    ]) {
      await t.test(label, async () => {
        const res = response();
        await new AuthController().register({ body }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(databaseCalls, 0);
      });
    }
  } finally {
    if (originalSetting === undefined) delete process.env.ALLOW_PUBLIC_REGISTRATION;
    else process.env.ALLOW_PUBLIC_REGISTRATION = originalSetting;
  }
});
