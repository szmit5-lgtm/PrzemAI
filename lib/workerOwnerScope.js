"use strict";

function workerOwnerScope(env = process.env) {
  const hasOwner = Object.prototype.hasOwnProperty.call(env, "WORKER_OWNER_USER_ID");
  const serviceName = String(env.RAILWAY_SERVICE_NAME || "");
  // A staging worker must never silently become an unrestricted scheduler.
  // Its deployment must be configured with a dedicated owner scope.
  if (!hasOwner) {
    if (/worker.*staging|staging.*worker/i.test(serviceName)) {
      throw new Error("Staging worker requires WORKER_OWNER_USER_ID; refusing unscoped startup.");
    }
    return null;
  }
  const id = env.WORKER_OWNER_USER_ID;
  if (typeof id !== "string" || !id.trim() || id !== id.trim() || id.length > 128) {
    throw new Error("Invalid WORKER_OWNER_USER_ID; refusing unscoped worker startup.");
  }
  return id;
}
module.exports = { workerOwnerScope };
