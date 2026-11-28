"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync, spawnSync } = require("node:child_process");
const { verifyRehearsalRestore } = require("./check-rehearsal-restore");
const { SCHEMA_QUERY } = require("./staging-schema-probe");

const repo = path.resolve(__dirname, "..");
const migrationDirectory = path.join(repo, "prisma", "migrations");

function assertChecksums(rows, readMigration) {
  if (!Array.isArray(rows) || !rows.length) throw Error("REHEARSAL_HISTORY_EMPTY");
  const seen = new Set();
  for (const row of rows) {
    if (!/^\d{14}_[a-zA-Z0-9_]{1,200}$/.test(row.migration_name) || seen.has(row.migration_name))
      throw Error("REHEARSAL_HISTORY_INVALID");
    seen.add(row.migration_name);
    const checksum = createHash("sha256").update(readMigration(row.migration_name)).digest("hex");
    if (row.checksum !== checksum) throw Error("REHEARSAL_CHECKSUM_MISMATCH");
  }
}

async function rehearse({ env, evidence, createClient, readMigration, prisma, apply }) {
  await verifyRehearsalRestore({ env, evidence, createClient, inspect: async tx => {
    const rows = await tx.$queryRaw`
      SELECT migration_name, checksum FROM public."_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    assertChecksums(rows, readMigration);
  } });
  if (!apply) return "BASELINE_VERIFIED";
  await prisma("deploy");
  await prisma("status");
  const db = createClient(env.DATABASE_URL);
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
      const rows = await tx.$queryRawUnsafe(SCHEMA_QUERY);
      if (rows?.length !== 1 || Object.values(rows[0]).some(value => value !== true))
        throw Error("REHEARSAL_SCHEMA_UNVERIFIED");
    });
  } finally {
    await db.$disconnect();
  }
  return "NATIVE_MIGRATIONS_AND_SCHEMA_VERIFIED";
}

async function main() {
  try {
    const [filename, sha, mode, ...extra] = process.argv.slice(2);
    if (extra.length || !["--check", "--apply"].includes(mode) || !/^[a-f0-9]{40}$/.test(sha || "") ||
        !filename || fs.statSync(filename).size > 8192 || !fs.statSync(filename).isFile())
      throw Error("REHEARSAL_ARGUMENTS_INVALID");
    const git = args => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (git(["rev-parse", "HEAD"]) !== sha || git(["status", "--porcelain", "--",
      "prisma", "package.json", "package-lock.json", "scripts", "prisma.config.*"]))
      throw Error("REHEARSAL_CANDIDATE_UNVERIFIED");
    const result = await rehearse({
      env: process.env, evidence: JSON.parse(fs.readFileSync(filename, "utf8")), apply: mode === "--apply",
      createClient(datasourceUrl) { return new (require("@prisma/client").PrismaClient)({ datasourceUrl }); },
      readMigration(name) { return fs.readFileSync(path.join(migrationDirectory, name, "migration.sql")); },
      prisma(command) {
        const result = spawnSync(path.join(repo, "node_modules", ".bin", "prisma"), ["migrate", command], {
          cwd: repo, env: { PATH: process.env.PATH, DATABASE_URL: process.env.DATABASE_URL },
          stdio: "ignore", timeout: 300000
        });
        if (result.status !== 0) throw Error("REHEARSAL_PRISMA_" + command.toUpperCase() + "_FAILED");
      }
    });
    console.log("[REHEARSAL] " + result);
  } catch (error) {
    const safe = /^(?:REHEARSAL_[A-Z_]+|STAGING_ISOLATION_UNVERIFIED)$/;
    console.error("[REHEARSAL] " + (safe.test(error.message) ? error.message : "REHEARSAL_FAILED"));
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
module.exports = { assertChecksums, rehearse };
