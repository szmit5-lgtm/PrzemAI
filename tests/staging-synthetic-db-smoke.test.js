"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { smoke, ROLLBACK } = require("../scripts/staging-synthetic-db-smoke");

const env = {
  RAILWAY_PROJECT_ID: "8b898b94-7bca-4a34-af28-8f114d776825",
  RAILWAY_ENVIRONMENT_ID: "64404202-9c65-4076-a917-111e6448281a",
  RAILWAY_ENVIRONMENT_NAME: "staging",
  RAILWAY_SERVICE_ID: "1f155ed3-d2b7-4d65-b476-c040d02d8fa6",
  DATABASE_URL: "postgresql://fixture:secret@postgres-vycl.railway.internal:5432/fixture",
  KSEF_SYNC_ENABLED: "false",
  KSEF_DEHERUS_SYNC_ENABLED: "false",
  CLAUDE_DEV_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false",
  STAGING_SYNTHETIC_WRITE_TEST: "true"
};

function fakeDb({ corruptDuplicate = false } = {}) {
  let commitAttempt = false;
  let rollbackObserved = false;
  let orgs = 0;
  const calls = [];
  let seenMessage = false;
  const tx = {
    organization: {
      async create() { orgs++; return { id: "fake-org-" + orgs }; }
    },
    whatsAppMessage: {
      async createMany() {
        calls.push("message");
        if (!seenMessage) { seenMessage = true; return { count: 1 }; }
        return { count: corruptDuplicate ? 1 : 0 };
      },
      async count({ where }) { return where.organizationId === "fake-org-1" ? 1 : 0; }
    },
    bankAccount: {
      async create({ data }) {
        calls.push("account");
        return { id: "acct-" + data.organizationId };
      }
    },
    bankStatement: {
      async create({ data }) {
        calls.push("statement");
        return { id: "statement", openingBalance: { toString: () => data.openingBalance },
          closingBalance: { toString: () => data.closingBalance } };
      }
    },
    bankTransaction: {
      async create({ data }) {
        calls.push("transaction");
        return { amount: { toString: () => data.amount } };
      },
      async count() { return 0; }
    }
  };
  const db = {
    async $transaction(callback) {
      try {
        await callback(tx);
        commitAttempt = true;
      } catch (error) {
        if (error === ROLLBACK) rollbackObserved = true;
        throw error;
      }
    }
  };
  return { db, calls, get rollbackObserved() { return rollbackObserved; },
    get commitAttempt() { return commitAttempt; } };
}

test("synthetic smoke checks dedupe and bank precision but deliberately rolls back", async () => {
  const stub = fakeDb();
  const lines = [];
  const result = await smoke({ env, db: stub.db, log: { log: x => lines.push(x) } });
  assert.deepEqual(result, {
    whatsappDedupe: true, tenantIsolation: true, bankDecimals: true, rolledBack: true
  });
  assert.equal(stub.rollbackObserved, true);
  assert.equal(stub.commitAttempt, false);
  assert.deepEqual(stub.calls, ["message", "message", "account", "account", "statement", "transaction"]);
  assert.match(lines[0], /rolled_back=true/);
  assert.doesNotMatch(lines[0], /fixture|secret|fake-org/);
});

test("synthetic smoke refuses production and disabled switch without DB access", async () => {
  const stub = fakeDb();
  for (const patch of [
    { RAILWAY_ENVIRONMENT_NAME: "production" },
    { STAGING_SYNTHETIC_WRITE_TEST: "false" },
    { RAILWAY_SERVICE_ID: "other-service" }
  ]) {
    await assert.rejects(smoke({ env: { ...env, ...patch }, db: stub.db }),
      /STAGING_ISOLATION_UNVERIFIED|STAGING_SYNTHETIC_TEST_NOT_ENABLED/);
  }
  assert.equal(stub.calls.length, 0);
});

test("synthetic smoke fails closed and never commits if duplicate is inserted", async () => {
  const stub = fakeDb({ corruptDuplicate: true });
  await assert.rejects(smoke({ env, db: stub.db }), /STAGING_SYNTHETIC_TEST_FAILED/);
  assert.equal(stub.commitAttempt, false);
  assert.equal(stub.rollbackObserved, false);
  assert.deepEqual(stub.calls, ["message", "message"]);
});
