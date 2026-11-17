"use strict";

/**
 * One-shot synthetic staging database smoke test.
 * Prisma interactive transaction always rolls back; no business records persist.
 * It does not send WhatsApp messages, call paid providers or run migrations.
 */
const crypto = require("node:crypto");
const { check } = require("./check-staging-isolation");
const ROLLBACK = Symbol("EXPECTED_SYNTHETIC_ROLLBACK");

async function smoke({ env = process.env, db, log = console } = {}) {
  check(env);
  if (env.STAGING_SYNTHETIC_WRITE_TEST !== "true") {
    throw new Error("STAGING_SYNTHETIC_TEST_NOT_ENABLED");
  }
  if (!db || typeof db.$transaction !== "function") {
    throw new Error("STAGING_SYNTHETIC_DB_UNAVAILABLE");
  }
  const suffix = crypto.randomBytes(12).toString("hex");
  const externalMessageId = "wamid.TEST-" + suffix;
  const fakeIban = "PL61109010140000071219812874";
  let completed = false;
  try {
    await db.$transaction(async tx => {
      // Both companies are synthetic, confined to this uncommitted transaction.
      const a = await tx.organization.create({
        data: { slug: "staging-smoke-a-" + suffix, name: "STAGING_SMOKE_A" }
      });
      const b = await tx.organization.create({
        data: { slug: "staging-smoke-b-" + suffix, name: "STAGING_SMOKE_B" }
      });
      const message = {
        organizationId: a.id, externalMessageId,
        phoneNumberId: "staging-not-meta", contactWaId: "48111111111",
        messageType: "text", text: "STAGING_TEST_ONLY",
        receivedAt: new Date("2026-11-15T00:00:00.000Z")
      };
      const created = await tx.whatsAppMessage.createMany({ data: [message], skipDuplicates: true });
      const duplicate = await tx.whatsAppMessage.createMany({ data: [message], skipDuplicates: true });
      if (created.count !== 1 || duplicate.count !== 0) throw Error("WA_DEDUPE_FAILED");

      const countA = await tx.whatsAppMessage.count({ where: { organizationId: a.id } });
      const countB = await tx.whatsAppMessage.count({ where: { organizationId: b.id } });
      if (countA !== 1 || countB !== 0) throw Error("WA_TENANT_ISOLATION_FAILED");

      const account = await tx.bankAccount.create({
        data: { organizationId: a.id, iban: fakeIban, currency: "PLN" }
      });
      const otherAccount = await tx.bankAccount.create({
        data: { organizationId: b.id, iban: fakeIban, currency: "PLN" }
      });
      if (!account.id || !otherAccount.id || account.id === otherAccount.id) {
        throw Error("BANK_TENANT_ISOLATION_FAILED");
      }
      const statement = await tx.bankStatement.create({
        data: {
          organizationId: a.id, bankAccountId: account.id,
          statementNumber: "STAGING-" + suffix, sourceHash: suffix,
          openingBalance: "90071992547409.91",
          closingBalance: "90071992547409.92",
          periodEnd: new Date("2026-11-15T00:00:00.000Z"),
          importedByUserId: "synthetic-not-real",
          transactionCount: 1
        }
      });
      const transaction = await tx.bankTransaction.create({
        data: {
          organizationId: a.id, bankAccountId: account.id,
          bankStatementId: statement.id,
          bookedAt: new Date("2026-11-15T00:00:00.000Z"),
          amount: "0.01", fingerprint: "test-" + suffix,
          description: "STAGING_TEST_ONLY"
        }
      });
      if (String(statement.openingBalance) !== "90071992547409.91" ||
          String(statement.closingBalance) !== "90071992547409.92" ||
          String(transaction.amount) !== "0.01") throw Error("BANK_DECIMAL_PRECISION_FAILED");
      const countOther = await tx.bankTransaction.count({ where: { organizationId: b.id } });
      if (countOther !== 0) throw Error("BANK_TRANSACTION_ISOLATION_FAILED");

      completed = true;
      // No successful database commit is allowed, even when all assertions pass.
      throw ROLLBACK;
    }, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (error !== ROLLBACK || !completed) {
      throw new Error("STAGING_SYNTHETIC_TEST_FAILED");
    }
  }
  log.log("[STAGING-SYNTHETIC] whatsapp_dedupe=pass tenant_isolation=pass bank_decimals=pass rolled_back=true");
  return { whatsappDedupe: true, tenantIsolation: true, bankDecimals: true, rolledBack: true };
}

async function main() {
  const db = require("../lib/prisma");
  try {
    await smoke({ db });
  } catch (_) {
    console.error("[STAGING-SYNTHETIC] TEST_FAILED");
    process.exitCode = 1;
  } finally {
    await db.$disconnect().catch(() => {});
  }
}
if (require.main === module) main().catch(() => {
  console.error("[STAGING-SYNTHETIC] TEST_FAILED");
  process.exitCode = 1;
});
module.exports = { smoke, ROLLBACK };
