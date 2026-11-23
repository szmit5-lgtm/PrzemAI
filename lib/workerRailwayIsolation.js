"use strict";

// Railway deploy safety: staging-labelled workers must never consume production queues.
// Production workers are allowed only in the actual production environment.
// Missing Railway metadata remains supported for local development, but never
// when RAILWAY_ENVIRONMENT_NAME is set without a service name.
function checkWorkerRailwayIsolation(env) {
  const environment = String(env.RAILWAY_ENVIRONMENT_NAME || "").trim().toLowerCase();
  const service = String(env.RAILWAY_SERVICE_NAME || "").trim().toLowerCase();
  if (!environment) return service || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID
    ? { ok: false, reason: "missing_railway_environment_name" }
    : { ok: true, reason: "local_or_unmanaged" };
  if (environment !== "production" && environment !== "staging") {
    return { ok: false, reason: "unsupported_railway_environment" };
  }
  if (!service) return { ok: false, reason: "missing_railway_service_name" };
  const stagingNamed = /(^|[-_])(?:staging|test)(?:$|[-_])/.test(service);
  const productionNamed = /(^|[-_])production(?:$|[-_])/.test(service);
  if (environment === "production" && stagingNamed) {
    return { ok: false, reason: "staging_worker_in_production_environment" };
  }
  if (environment !== "production" && productionNamed) {
    return { ok: false, reason: "production_worker_outside_production_environment" };
  }
  // A service labelled production/staging is not necessarily a worker.
  // Deny API/frontend names even when their environment suffix matches.
  const workerNamed = /(^|[-_])worker(?:$|[-_])/.test(service);
  if (!workerNamed || (!stagingNamed && !productionNamed)) {
    return { ok: false, reason: "unclassified_worker_service" };
  }
  return { ok: true, reason: "matched_environment" };
}
module.exports = { checkWorkerRailwayIsolation };
