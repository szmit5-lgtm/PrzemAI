"use strict";

function workerOwnerScope(env = process.env) {
  // Omitting the variable keeps the existing staging worker behavior.
  // When present, even an empty/malformed value must fail closed.
  if (!Object.prototype.hasOwnProperty.call(env, "WORKER_OWNER_USER_ID")) return null;
  const id = env.WORKER_OWNER_USER_ID;
  if (typeof id !== "string" || !id.trim() || id !== id.trim() || id.length > 128) {
    throw new Error("Invalid WORKER_OWNER_USER_ID; refusing unscoped worker startup.");
  }
  return id;
}
module.exports = { workerOwnerScope };
