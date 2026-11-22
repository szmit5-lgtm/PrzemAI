"use strict";

// Railway deploy safety: staging-labelled workers must never consume production queues.
// Production workers are allowed only in the actual production environment.
// Missing Railway metadata remains supported for local development, but never
// when RAILWAY_ENVIRONMENT_NAME is set without a service name.
function checkWorkerRailwayIsolation(env) {
  const environment = String(env.RAILWAY_ENVIRONMENT_NAME || "").trim().toLowerCase();
  const service = String(env.RAILWAY_SERVICE_NAME || "").trim().toLowerCase();
  if (!environment) return { ok: true, reason: "local_or_unmanaged" };
  if (!service) return { ok: false, reason: "missing_railway_service_name" };
  const stagingNamed = /(^|[-_])(?:staging|test)(?:$|[-_])/.test(service);
  const productionNamed = /(^|[-_])production(?:$|[-_])/.test(service);
  if (environment === "production" && stagingNamed) {
    return { ok: false, reason: "staging_worker_in_production_environment" };
  }
  if (environment !== "production" && productionNamed) {
    return { ok: false, reason: "production_worker_outside_production_environment" };
  }
  return { ok: true, reason: "matched_environment" };
}
module.exports = { checkWorkerRailwayIsolation };
