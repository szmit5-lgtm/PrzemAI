"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let storedUser;
let lookupError;
let updateError;
let lookups;
let updates;
let hashes;
let comparisons;

const prisma = {
  user: {
    async findUnique(args) {
      lookups.push(args);
      if (lookupError) throw lookupError;
      return storedUser;
    },
    async update(args) {
      updates.push(args);
      if (updateError) throw updateError;
      return { id: args.where.id };
    }
  }
};

const hash = {
  async comparePassword(password, storedHash) {
    comparisons.push({ password, storedHash });
    return password === "current-secret";
  },
  async hashPassword(password) {
    hashes.push(password);
    return "hashed-new-secret";
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/api/controllers/AuthController.js")) {
    if (request === "jsonwebtoken") return { sign() { throw new Error("not used"); } };
    if (request === "../../lib/prisma") return prisma;
    if (request === "../../lib/hash") return hash;
  }
  return originalLoad.call(this, request, parent, isMain);
};

let AuthController;
try {
  AuthController = require("../api/controllers/AuthController");
} finally {
  Module._load = originalLoad;
}

function reset() {
  storedUser = { id: "user-1", email: "test@example.com", password: "stored-hash" };
  lookupError = null;
  updateError = null;
  lookups = [];
  updates = [];
  hashes = [];
  comparisons = [];
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function changePassword(body) {
  const res = response();
  await new AuthController().changePassword({ user: { id: "user-1" }, body }, res);
  return res;
}

test("password change rejects missing fields before any database access", async () => {
  for (const body of [{}, { currentPassword: "current-secret" }, { newPassword: "new-secret" }]) {
    reset();
    const res = await changePassword(body);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(lookups.length, 0);
    assert.equal(updates.length, 0);
  }
});

test("password change rejects new passwords shorter than eight characters", async () => {
  reset();
  const res = await changePassword({ currentPassword: "current-secret", newPassword: "short" });
  assert.equal(res.statusCode, 400);
  assert.equal(lookups.length, 0);
  assert.equal(updates.length, 0);
});

test("incorrect current password cannot update the stored hash", async () => {
  reset();
  const res = await changePassword({ currentPassword: "incorrect", newPassword: "different-new-secret" });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.deepEqual(lookups, [{ where: { id: "user-1" } }]);
  assert.equal(updates.length, 0);
  assert.equal(hashes.length, 0);
});

test("reusing the current password is rejected without writing", async () => {
  reset();
  const res = await changePassword({ currentPassword: "current-secret", newPassword: "current-secret" });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(comparisons.length, 2);
  assert.equal(updates.length, 0);
  assert.equal(hashes.length, 0);
});

test("valid password change stores only a new hash for the authenticated user", async () => {
  reset();
  const res = await changePassword({ currentPassword: "current-secret", newPassword: "different-new-secret" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(hashes, ["different-new-secret"]);
  assert.deepEqual(updates, [{ where: { id: "user-1" }, data: { password: "hashed-new-secret" } }]);
  assert.doesNotMatch(JSON.stringify(res.body), /current-secret|different-new-secret|hashed-new-secret/);
});

test("password change does not write if the authenticated user no longer exists", async () => {
  reset();
  storedUser = null;
  const res = await changePassword({ currentPassword: "current-secret", newPassword: "different-new-secret" });
  assert.equal(res.statusCode, 404);
  assert.equal(updates.length, 0);
  assert.equal(hashes.length, 0);
});

test("database write failure returns a generic error without leaking internals", async () => {
  reset();
  updateError = new Error("secret database hostname and credentials");
  const res = await changePassword({ currentPassword: "current-secret", newPassword: "different-new-secret" });
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(updates.length, 1);
  assert.doesNotMatch(JSON.stringify(res.body), /hostname|credentials|secret database/i);
});
