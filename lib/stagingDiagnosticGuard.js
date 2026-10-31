"use strict";

// Railway currently hosts staging-named services in an environment named
// "production". Check the exact service identity rather than that label.
const STAGING_SERVICES = new Set([
  "PrzemAI-staging",
  "PrzemAI-worker-staging"
]);

function stagingDiagnosticContext(env = process.env) {
  const onRailway = Boolean(
    env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID ||
    env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_ENVIRONMENT_NAME
  );

  if (onRailway) {
    if (!STAGING_SERVICES.has(env.RAILWAY_SERVICE_NAME)) {
      throw new Error("Read-only diagnostic is restricted to named PrzemAI staging services.");
    }
    return {
      railwayEnvironment: env.RAILWAY_ENVIRONMENT_NAME || null,
      databaseIsolationVerified: false
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
