"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { stagingDiagnosticContext } = require("../lib/stagingDiagnosticGuard");

const PROJECT_ID = "8b898b94-7bca-4a34-af28-8f114d776825";
const ENVIRONMENT_ID = "93d636bd-faba-4a8e-8522-b7b75be2de6c";
const SERVICES = {
  "PrzemAI-staging": "c38b4872-2d7c-4ec6-9422-cc560eb329fd",
  "PrzemAI-worker-staging": "e0760856-81ba-48d9-898d-953b976ca5b1"
};

const railway = (serviceName) => ({
  RAILWAY_PROJECT_ID: PROJECT_ID,
  RAILWAY_ENVIRONMENT_ID: ENVIRONMENT_ID,
  RAILWAY_ENVIRONMENT_NAME: "production",
  RAILWAY_SERVICE_ID: SERVICES[serviceName] || "unknown-service-id",
  RAILWAY_SERVICE_NAME: serviceName
});

test("allows read-only diagnostic on the verified staging worker despite Railway environment name", () => {
  assert.deepEqual(stagingDiagnosticContext(railway("PrzemAI-worker-staging")), {
    railwayEnvironment: "production",
    databaseIsolationVerified: false
  });
});

test("allows verified staging API but never claims database isolation", () => {
  assert.equal(stagingDiagnosticContext(railway("PrzemAI-staging")).databaseIsolationVerified, false);
});

test("rejects production backend even with a local override", () => {
  assert.throws(
    () => stagingDiagnosticContext({ ...railway("PrzemAI"), PRZEMAI_ALLOW_LOCAL_DIAGNOSTIC: "true" }),
    /restricted to the verified PrzemAI staging services/
  );
});

test("rejects lookalikes and unknown services", () => {
  assert.throws(() => stagingDiagnosticContext(railway("PrzemAI-worker-staging-copy")));
  assert.throws(() => stagingDiagnosticContext(railway("Postgres")));
});

test("rejects staging service name with a different project, environment or service ID", () => {
  const valid = railway("PrzemAI-worker-staging");
  assert.throws(() => stagingDiagnosticContext({ ...valid, RAILWAY_PROJECT_ID: "other-project" }));
  assert.throws(() => stagingDiagnosticContext({ ...valid, RAILWAY_ENVIRONMENT_ID: "other-environment" }));
  assert.throws(() => stagingDiagnosticContext({ ...valid, RAILWAY_SERVICE_ID: SERVICES["PrzemAI-staging"] }));
  assert.throws(() => stagingDiagnosticContext({ ...valid, RAILWAY_SERVICE_ID: undefined }));
});

test("rejects partial Railway metadata even when local opt-in is set", () => {
  assert.throws(() => stagingDiagnosticContext({
    RAILWAY_SERVICE_NAME: "PrzemAI-worker-staging",
    PRZEMAI_ALLOW_LOCAL_DIAGNOSTIC: "true"
  }));
});

test("requires explicit opt-in when not on Railway", () => {
  assert.throws(() => stagingDiagnosticContext({}), /explicit opt-in/);
  assert.equal(stagingDiagnosticContext({ PRZEMAI_ALLOW_LOCAL_DIAGNOSTIC: "true" }).railwayEnvironment, null);
});

test("verifies isolation only for the exact new staging database endpoint", () => {
  const isolatedUrl = "postgresql://tester:dummy@postgres-uvfd.railway.internal:5432/railway?schema=public";
  for (const serviceName of ["PrzemAI-staging", "PrzemAI-worker-staging"]) {
    assert.equal(stagingDiagnosticContext({
      ...railway(serviceName), DATABASE_URL: isolatedUrl
    }).databaseIsolationVerified, true);
  }
});

test("fails closed for production, lookalike, malformed and non-PostgreSQL database URLs", () => {
  const candidates = [
    undefined,
    "",
    "not-a-url",
    "postgresql://u:p@postgres.railway.internal:5432/railway",
    "postgresql://u:p@postgres-uvfd.railway.internal.attacker.invalid:5432/railway",
    "postgresql://postgres-uvfd.railway.internal@postgres.railway.internal:5432/railway",
    "https://postgres-uvfd.railway.internal:5432/railway",
    "postgresql://u:p@postgres-uvfd.railway.internal:5432/other"
  ];
  for (const databaseUrl of candidates) {
    assert.equal(stagingDiagnosticContext({
      ...railway("PrzemAI-worker-staging"), DATABASE_URL: databaseUrl
    }).databaseIsolationVerified, false);
  }
});

test("local opt-in cannot claim isolated staging even with the staging database URL", () => {
  const context = stagingDiagnosticContext({
    PRZEMAI_ALLOW_LOCAL_DIAGNOSTIC: "true",
    DATABASE_URL: "postgresql://u:p@postgres-uvfd.railway.internal:5432/railway"
  });
  assert.equal(context.databaseIsolationVerified, false);
});

test("database isolation fails closed for PostgreSQL URI connection overrides", () => {
  const base = "postgresql://tester:dummy@postgres-uvfd.railway.internal:5432/railway";
  const valid = stagingDiagnosticContext({
    ...railway("PrzemAI-worker-staging"), DATABASE_URL: base + "?schema=public"
  });
  assert.equal(valid.databaseIsolationVerified, true);

  for (const suffix of [
    "?host=postgres.railway.internal",
    "?%68ost=postgres.railway.internal",
    "?port=5434",
    "?dbname=production",
    "?schema=public&host=postgres.railway.internal",
    "#host=postgres.railway.internal"
  ]) {
    const context = stagingDiagnosticContext({
      ...railway("PrzemAI-worker-staging"), DATABASE_URL: base + suffix
    });
    assert.equal(context.databaseIsolationVerified, false, suffix);
  }
});
