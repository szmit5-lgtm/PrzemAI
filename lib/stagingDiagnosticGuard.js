"use strict";

// Railway hosts staging-named services in an environment called "production".
// Match the exact project, environment and service identity: a service name
// alone is insufficient to prove the diagnostic is running in staging.
const STAGING_PROJECT_ID = "8b898b94-7bca-4a34-af28-8f114d776825";
const STAGING_ENVIRONMENT_ID = "93d636bd-faba-4a8e-8522-b7b75be2de6c";
const STAGING_SERVICES = new Map([
  ["c38b4872-2d7c-4ec6-9422-cc560eb329fd", "PrzemAI-staging"],
  ["e0760856-81ba-48d9-898d-953b976ca5b1", "PrzemAI-worker-staging"]
]);

// Fail closed unless the verified staging service points to the separate
// PostgreSQL service provisioned for staging. This exact private hostname was
// confirmed from Prisma migration logs on 2026-11-02. A renamed/replaced DB
// must be re-verified before this allowlist is updated.
const STAGING_DATABASE_HOST = "postgres-uvfd.railway.internal";

function verifiedIsolatedStagingDatabase(env) {
  if (typeof env.DATABASE_URL !== "string") return false;
  try {
    const url = new URL(env.DATABASE_URL);
    return (url.protocol === "postgresql:" || url.protocol === "postgres:") &&
      url.hostname === STAGING_DATABASE_HOST &&
      url.port === "5432" &&
      url.pathname === "/railway";
  } catch {
    return false;
  }
}

function stagingDiagnosticContext(env = process.env) {
  const onRailway = Boolean(
    env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID ||
    env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_ENVIRONMENT_NAME ||
    env.RAILWAY_SERVICE_NAME
  );

  if (onRailway) {
    if (
      env.RAILWAY_PROJECT_ID !== STAGING_PROJECT_ID ||
      env.RAILWAY_ENVIRONMENT_ID !== STAGING_ENVIRONMENT_ID ||
      STAGING_SERVICES.get(env.RAILWAY_SERVICE_ID) !== env.RAILWAY_SERVICE_NAME
    ) {
      throw new Error("Read-only diagnostic is restricted to the verified PrzemAI staging services.");
    }
    return {
      railwayEnvironment: env.RAILWAY_ENVIRONMENT_NAME || null,
      databaseIsolationVerified: verifiedIsolatedStagingDatabase(env)
    };
  }

  if (env.PRZEMAI_ALLOW_LOCAL_DIAGNOSTIC !== "true") {
    throw new Error("Local read-only diagnostic requires explicit opt-in.");
  }

  return {
    railwayEnvironment: null,
    databaseIsolationVerified: false
  };
}

module.exports = { stagingDiagnosticContext };
