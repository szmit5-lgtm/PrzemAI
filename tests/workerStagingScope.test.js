"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { workerOwnerScope } = require("../lib/workerOwnerScope");

test("staging worker without owner scope fails closed", () => {
  assert.throws(() => workerOwnerScope({ RAILWAY_SERVICE_NAME: "PrzemAI-worker-staging" }), /requires WORKER_OWNER_USER_ID/);
});
test("staging worker with owner scope is isolated", () => {
  assert.equal(workerOwnerScope({ RAILWAY_SERVICE_NAME: "PrzemAI-worker-staging", WORKER_OWNER_USER_ID: "owner-1" }), "owner-1");
});
test("invalid explicit scope fails closed for any worker", () => {
  assert.throws(() => workerOwnerScope({ RAILWAY_SERVICE_NAME: "PrzemAI-worker-production", WORKER_OWNER_USER_ID: " " }), /Invalid WORKER_OWNER_USER_ID/);
});
test("legacy production without scope retains existing behavior until rollout", () => {
  assert.equal(workerOwnerScope({ RAILWAY_SERVICE_NAME: "PrzemAI-worker-production" }), null);
});
