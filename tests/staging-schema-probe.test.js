"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { probe, SCHEMA_QUERY } = require("../scripts/staging-schema-probe");

const env = {
  RAILWAY_PROJECT_ID: "8b898b94-7bca-4a34-af28-8f114d776825",
  RAILWAY_ENVIRONMENT_ID: "64404202-9c65-4076-a917-111e6448281a",
  RAILWAY_ENVIRONMENT_NAME: "staging",
  RAILWAY_SERVICE_ID: "1f155ed3-d2b7-4d65-b476-c040d02d8fa6",
  DATABASE_URL: "postgresql://fixture:unused@postgres-vycl.railway.internal:5432/fixture",
  KSEF_SYNC_ENABLED: "false",
  KSEF_DEHERUS_SYNC_ENABLED: "false",
  CLAUDE_DEV_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false"
};

test("schema probe uses only a fixed read-only catalog query", async () => {
  const output = [];
  let queryCount = 0;
  const db = {
    async $queryRawUnsafe(sql) {
      queryCount++;
      assert.equal(sql, SCHEMA_QUERY);
      assert.match(sql, /^SELECT\b/);
      assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
      return [{
        whatsapp: true, bankAccount: true, bankStatement: false,
        bankTransaction: false, migrations: true
      }];
    }
  };
  const result = await probe({ env, db, log: { log: text => output.push(text) } });
  assert.equal(queryCount, 1);
  assert.deepEqual(result, {
    whatsapp: true, bankAccount: true, bankStatement: false,
    bankTransaction: false, migrations: true
  });
  assert.match(output[0], /bankStatement=absent/);
  assert.doesNotMatch(output[0], /fixture|postgres-vycl|unused/);
});

test("schema probe rejects production before attempting any database query", async () => {
  let called = false;
  await assert.rejects(
    probe({
      env: { ...env, RAILWAY_ENVIRONMENT_NAME: "production" },
      db: { async $queryRawUnsafe() { called = true; return []; } },
      log: { log() {} }
    }),
    /STAGING_ISOLATION_UNVERIFIED/
  );
  assert.equal(called, false);
});

test("schema probe rejects unexpected catalog output", async () => {
  for (const rows of [[], [{}], [{ whatsapp: "true" }], null]) {
    await assert.rejects(
      probe({
        env,
        db: { async $queryRawUnsafe() { return rows; } },
        log: { log() {} }
      }),
      /STAGING_SCHEMA_PROBE_INVALID_RESULT/
    );
  }
});
