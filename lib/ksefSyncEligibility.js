"use strict";

// A missing owner binding must never authorize a shared Railway KSeF token.
// Return only fixed diagnostic codes: never expose a NIP, user ID or token.
function getKsefSyncEligibility(userId, env = process.env) {
  if (!env || env.KSEF_SYNC_ENABLED !== "true") {
    return { allowed: false, status: "DISABLED" };
  }
  if (typeof userId !== "string" || !userId.trim() || userId !== userId.trim()) {
    return { allowed: false, status: "INVALID_USER" };
  }
  const owner = env.KSEF_OWNER_USER_ID;
  if (typeof owner !== "string" || !owner.trim() || owner !== owner.trim()) {
    return { allowed: false, status: "OWNER_NOT_CONFIGURED" };
  }
  if (owner !== userId) {
    return { allowed: false, status: "OWNER_MISMATCH" };
  }
  if (typeof env.KSEF_NIP !== "string" || !/^[0-9]{10}$/.test(env.KSEF_NIP)) {
    return { allowed: false, status: "INVALID_NIP" };
  }
  if (typeof env.KSEF_TOKEN !== "string" || !env.KSEF_TOKEN.trim() || env.KSEF_TOKEN !== env.KSEF_TOKEN.trim()) {
    return { allowed: false, status: "TOKEN_MISSING" };
  }
  if (env.KSEF_ENVIRONMENT !== "production") {
    return { allowed: false, status: "ENVIRONMENT_NOT_PRODUCTION" };
  }
  return { allowed: true, status: "READY" };
}

module.exports = { getKsefSyncEligibility };
