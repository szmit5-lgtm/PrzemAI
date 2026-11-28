"use strict";

const { readFileSync, statSync } = require("node:fs");
const { check } = require("./check-staging-isolation");

const DATABASE = "przemai_p0_rehearsal";
const PRODUCTION_CLUSTER = "7673220878021664822";
const DIGEST = /^[0-9a-f]{64}$/i;
const MIGRATION = /^\d{14}_[a-zA-Z0-9_]{1,200}$/;
const IDENTITY_SQL = `
  SELECT pg_catalog.current_database() AS database,
    pg_catalog.current_setting('transaction_read_only') = 'on' AS "readOnly",
    system_identifier::text AS cluster,
    pg_catalog.to_regclass('public."_prisma_migrations"') IS NOT NULL AS migrations,
    pg_catalog.to_regclass('public."User"') IS NOT NULL AS users,
    pg_catalog.to_regclass('public."Organization"') IS NOT NULL AS organizations
  FROM pg_catalog.pg_control_system()
`;
const HISTORY_SQL = `
  SELECT
    (SELECT migration_name FROM public."_prisma_migrations"
     WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
     ORDER BY finished_at DESC, migration_name DESC LIMIT 1) AS latest,
    NOT EXISTS (
      SELECT 1 FROM public."_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ) AS clean
`;

function validateEvidence(evidence) {
  if (!evidence || evidence.database !== DATABASE ||
      typeof evidence.cluster !== "string" || !/^[1-9]\d{0,19}$/.test(evidence.cluster) ||
      evidence.cluster === PRODUCTION_CLUSTER ||
      typeof evidence.archiveSha256 !== "string" || !DIGEST.test(evidence.archiveSha256) ||
      typeof evidence.restoredArchiveSha256 !== "string" ||
      evidence.archiveSha256.toLowerCase() !== evidence.restoredArchiveSha256.toLowerCase() ||
      evidence.restoreExitCode !== 0 || evidence.schemaAndDataComplete !== true ||
      typeof evidence.latestMigration !== "string" || !MIGRATION.test(evidence.latestMigration)) {
    throw new Error("REHEARSAL_RESTORE_EVIDENCE_INVALID");
  }
}

async function verifyRehearsalRestore({ env = process.env, evidence, createClient, inspect } = {}) {
  check(env, { database: DATABASE });
  // Metadata can confirm the target and baseline. The operator must separately
  // attest that the verified archive finished restoring both schema and data.
  validateEvidence(evidence);

  const db = createClient(env.DATABASE_URL);
  try {
    return await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
      const identities = await tx.$queryRawUnsafe(IDENTITY_SQL);
      const identity = identities?.length === 1 && identities[0];
      if (!identity || identity.database !== DATABASE || identity.readOnly !== true ||
          identity.cluster !== evidence.cluster || identity.cluster === PRODUCTION_CLUSTER ||
          identity.migrations !== true || identity.users !== true || identity.organizations !== true) {
        throw new Error("REHEARSAL_DATABASE_UNVERIFIED");
      }

      const histories = await tx.$queryRawUnsafe(HISTORY_SQL);
      const history = histories?.length === 1 && histories[0];
      if (!history || history.clean !== true || history.latest !== evidence.latestMigration) {
        throw new Error("REHEARSAL_BASELINE_UNVERIFIED");
      }
      if (inspect) await inspect(tx);
      return { targetAndBaselineVerified: true, operatorRestoreAttestationAccepted: true };
    });
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  try {
    const filename = process.argv[2];
    const stat = filename && statSync(filename);
    if (!stat || !stat.isFile() || stat.size > 8192 || process.argv.length !== 3) {
      throw new Error("REHEARSAL_RESTORE_EVIDENCE_INVALID");
    }
    const evidence = JSON.parse(readFileSync(filename, "utf8"));
    await verifyRehearsalRestore({
      evidence,
      createClient(datasourceUrl) {
        const { PrismaClient } = require("@prisma/client");
        return new PrismaClient({ datasourceUrl });
      }
    });
    console.log("[REHEARSAL] TARGET_AND_BASELINE_VERIFIED; OPERATOR_RESTORE_ATTESTATION_ACCEPTED");
  } catch (_) {
    console.error("[REHEARSAL] RESTORE_READINESS_UNVERIFIED");
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = { verifyRehearsalRestore };
