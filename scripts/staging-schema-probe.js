"use strict";

/**
 * Read-only staging schema probe. No migrations, DB writes or business data reads.
 * Never log DATABASE_URL, database names, user identifiers or Prisma errors.
 */
const { check } = require("./check-staging-isolation");

const SCHEMA_QUERY = [
  'SELECT',
  'to_regclass(\'public."WhatsAppMessage"\') IS NOT NULL AS "whatsapp",',
  'to_regclass(\'public."BankAccount"\') IS NOT NULL AS "bankAccount",',
  'to_regclass(\'public."BankStatement"\') IS NOT NULL AS "bankStatement",',
  'to_regclass(\'public."BankTransaction"\') IS NOT NULL AS "bankTransaction",',
  'to_regclass(\'public."_prisma_migrations"\') IS NOT NULL AS "migrations",',
  'EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = \'OrganizationInvestment\' AND column_name = \'assignedUserIds\' AND udt_name = \'_text\' AND is_nullable = \'NO\') AS "investmentAssignees"'
].join(" ");

async function probe({ env = process.env, db, log = console } = {}) {
  check(env);
  if (!db || typeof db.$queryRawUnsafe !== "function") {
    throw new Error("STAGING_SCHEMA_PROBE_UNAVAILABLE");
  }
  // The SQL is a hard-coded SELECT of catalog metadata only, not user input.
  const rows = await db.$queryRawUnsafe(SCHEMA_QUERY);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("STAGING_SCHEMA_PROBE_INVALID_RESULT");
  }
  const keys = ["whatsapp", "bankAccount", "bankStatement", "bankTransaction", "migrations", "investmentAssignees"];
  const result = {};
  for (const key of keys) {
    if (typeof rows[0][key] !== "boolean") {
      throw new Error("STAGING_SCHEMA_PROBE_INVALID_RESULT");
    }
    result[key] = rows[0][key];
  }
  log.log("[STAGING-SCHEMA] " + keys.map(key => key + "=" + (result[key] ? "present" : "absent")).join(" "));
  return result;
}

async function main() {
  const db = require("../lib/prisma");
  try {
    await probe({ db });
  } catch (_) {
    // A connection or schema error must never echo credentials or SQL details.
    console.error("[STAGING-SCHEMA] READ_ONLY_PROBE_FAILED");
    process.exitCode = 1;
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error("[STAGING-SCHEMA] READ_ONLY_PROBE_FAILED");
    process.exitCode = 1;
  });
}

module.exports = { probe, SCHEMA_QUERY };
