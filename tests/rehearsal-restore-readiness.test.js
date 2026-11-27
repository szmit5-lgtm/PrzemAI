"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { verifyRehearsalRestore } = require("../scripts/check-rehearsal-restore");
const { check } = require("../scripts/check-staging-isolation");

const env = {
  RAILWAY_PROJECT_ID: "8b898b94-7bca-4a34-af28-8f114d776825",
  RAILWAY_ENVIRONMENT_ID: "64404202-9c65-4076-a917-111e6448281a",
  RAILWAY_ENVIRONMENT_NAME: "staging",
  RAILWAY_SERVICE_ID: "1f155ed3-d2b7-4d65-b476-c040d02d8fa6",
  DATABASE_URL: "postgresql://fixture:local-only@postgres-vycl.railway.internal:5432/przemai_p0_rehearsal",
  KSEF_SYNC_ENABLED: "false",
  KSEF_DEHERUS_SYNC_ENABLED: "false",
  CLAUDE_DEV_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false"
};
const evidence = {
  database: "przemai_p0_rehearsal",
  cluster: "1234567890123456789",
  archiveSha256: "a".repeat(64),
  restoredArchiveSha256: "a".repeat(64),
  restoreExitCode: 0,
  schemaAndDataComplete: true,
  latestMigration: "20261126190000_financial_intelligence"
};

function fixture({ identity = {}, history = {} } = {}) {
  const calls = [];
  return {
    calls,
    createClient(url) {
      assert.equal(url, env.DATABASE_URL);
      calls.push("connect");
      return {
        async $transaction(callback) {
          return callback({
            async $executeRawUnsafe(sql) { calls.push(sql); },
            async $queryRawUnsafe(sql) {
              assert.match(sql.trim(), /^SELECT/);
              if (sql.includes("pg_control_system()")) {
                calls.push("identity");
                return [{ database: evidence.database, cluster: evidence.cluster, readOnly: true,
                  migrations: true, users: true, organizations: true, ...identity }];
              }
              assert.match(sql, /public\."_prisma_migrations"/);
              calls.push("migration history");
              return [{ latest: evidence.latestMigration, clean: true, ...history }];
            }
          });
        },
        async $disconnect() { calls.push("disconnect"); }
      };
    }
  };
}

test("verifies a matching staging restore and executes metadata queries in read-only mode", async () => {
  const db = fixture();
  assert.deepEqual(await verifyRehearsalRestore({ env, evidence, createClient: db.createClient }),
    { targetAndBaselineVerified: true, operatorRestoreAttestationAccepted: true });
  assert.deepEqual(db.calls, ["connect", "SET TRANSACTION READ ONLY", "SET LOCAL statement_timeout = '5s'",
    "identity", "migration history", "disconnect"]);
  assert.throws(() => check(env), /STAGING_ISOLATION_UNVERIFIED/);
  assert.equal(check({ ...env, DATABASE_URL: env.DATABASE_URL.replace("/przemai_p0_rehearsal", "/railway") }).ok, true);
});

test("rejects absent or untrustworthy restore evidence before connecting", async () => {
  for (const invalid of [undefined, { ...evidence, restoreExitCode: 1 },
    { ...evidence, schemaAndDataComplete: false }, { ...evidence, restoredArchiveSha256: "b".repeat(64) },
    { ...evidence, cluster: "7673220878021664822" }]) {
    await assert.rejects(verifyRehearsalRestore({ env, evidence: invalid,
      createClient: () => assert.fail("unexpected connection") }), /REHEARSAL_RESTORE_EVIDENCE_INVALID/);
  }
});

test("rejects unverified hosts, database names and staging metadata before connecting", async () => {
  for (const invalid of [{ ...env, DATABASE_URL: env.DATABASE_URL.replace("postgres-vycl", "postgres-prod") },
    { ...env, DATABASE_URL: env.DATABASE_URL.replace("/przemai_p0_rehearsal", "/railway") },
    { ...env, RAILWAY_ENVIRONMENT_NAME: "production" }, { ...env, KSEF_SYNC_ENABLED: "true" }]) {
    await assert.rejects(verifyRehearsalRestore({ env: invalid, evidence,
      createClient: () => assert.fail("unexpected connection") }), /STAGING_ISOLATION_UNVERIFIED/);
  }
});

test("rejects wrong runtime identity, incomplete schema, and unsuitable migration baseline", async () => {
  for (const [overrides, error] of [
    [{ identity: { cluster: "7673220878021664822" } }, /REHEARSAL_DATABASE_UNVERIFIED/],
    [{ identity: { readOnly: false } }, /REHEARSAL_DATABASE_UNVERIFIED/],
    [{ identity: { organizations: false } }, /REHEARSAL_DATABASE_UNVERIFIED/],
    [{ history: { clean: false } }, /REHEARSAL_BASELINE_UNVERIFIED/],
    [{ history: { latest: "20261125190000_older" } }, /REHEARSAL_BASELINE_UNVERIFIED/]
  ]) {
    const db = fixture(overrides);
    await assert.rejects(verifyRehearsalRestore({ env, evidence, createClient: db.createClient }), error);
    assert.equal(db.calls.at(-1), "disconnect");
  }
});
