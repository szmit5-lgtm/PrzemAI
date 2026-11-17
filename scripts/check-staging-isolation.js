"use strict";

/**
 * Fail-closed preflight for the one isolated Railway staging API service.
 * Reads connection metadata only, never connects to DB and never logs secrets.
 */
function check(env = process.env) {
  const fail = () => { throw new Error("STAGING_ISOLATION_UNVERIFIED"); };
  if (env.RAILWAY_PROJECT_ID !== "8b898b94-7bca-4a34-af28-8f114d776825" ||
      env.RAILWAY_ENVIRONMENT_ID !== "64404202-9c65-4076-a917-111e6448281a" ||
      env.RAILWAY_ENVIRONMENT_NAME !== "staging" ||
      env.RAILWAY_SERVICE_ID !== "1f155ed3-d2b7-4d65-b476-c040d02d8fa6") fail();

  let db;
  try { db = new URL(env.DATABASE_URL); } catch { fail(); }
  // Staging database's private Railway endpoint from its service config.
  if (!["postgresql:", "postgres:"].includes(db.protocol) ||
      db.hostname !== "postgres-vycl.railway.internal" ||
      !db.username || !db.password || !db.pathname || db.pathname === "/") fail();

  // No external/prod integration can run from the isolation test service.
  for (const key of ["KSEF_SYNC_ENABLED", "KSEF_DEHERUS_SYNC_ENABLED",
    "CLAUDE_DEV_ENABLED", "WHATSAPP_SEND_ENABLED"]) {
    if (env[key] !== "false") fail();
  }
  if (env.WHATSAPP_APP_SECRET || env.WHATSAPP_ACCESS_TOKEN ||
      env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ||
      env.DEKONICA_MAIL_PASSWORD) fail();
  return { ok: true, environment: "staging", databaseHost: "postgres-vycl.railway.internal" };
}

if (require.main === module) {
  try {
    const result = check();
    console.log("[STAGING-PREFLIGHT]", result.environment, "private DB host verified");
  } catch (_) {
    console.error("[STAGING-PREFLIGHT] STAGING_ISOLATION_UNVERIFIED");
    process.exitCode = 1;
  }
}

module.exports = { check };
