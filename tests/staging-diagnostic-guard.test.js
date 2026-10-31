"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { stagingDiagnosticContext } = require("../lib/stagingDiagnosticGuard");

const railway = (serviceName) => ({
  RAILWAY_PROJECT_ID: "project-id",
  RAILWAY_ENVIRONMENT_NAME: "production",
  RAILWAY_SERVICE_NAME: serviceName
});

test("allows read-only diagnostic on the staging worker despite Railway environment name", () => {
  assert.deepEqual(stagingDiagnosticContext(railway("PrzemAI-worker-staging")), {
    railwayEnvironment: "production",
    databaseIsolationVerified: false
  });
});

test("allows staging API but never claims database isolation", () => {
  assert.equal(stagingDiagnosticContext(railway("PrzemAI-staging")).databaseIsolationVerified, false);
});

test("rejects production backend even with a local override", () => {
  assert.throws(
    () => stagingDiagnosticContext({ ...railway("PrzemAI"), PRZEMAI_ALLOW_LOCAL_DIAGNOSTIC: "true" }),
    /restricted to named PrzemAI staging services/
  );
});

test("rejects production worker lookalikes and unknown services", () => {
  assert.throws(() => stagingDiagnosticContext(railway("PrzemAI-worker-staging-copy")));
  assert.throws(() => stagingDiagnosticContext(railway("Postgres")));
});

test("requires explicit opt-in when not on Railway", () => {
  assert.throws(() => stagingDiagnosticContext({}), /explicit opt-in/);
  assert.equal(stagingDiagnosticContext({ PRZEMAI_ALLOW_LOCAL_DIAGNOSTIC: "true" }).railwayEnvironment, null);
});
