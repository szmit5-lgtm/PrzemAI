"use strict";

// Pure authorization gate for future MT5 personal-account endpoints.
// Fail closed: never accept a tenant or owner supplied by request payload.
function authorizePersonalMt5({ authenticatedUserId, configuredOwnerUserId, organizationId }) {
  if (typeof configuredOwnerUserId !== "string" || !configuredOwnerUserId.trim()) {
    return { allowed: false, reason: "owner_not_configured" };
  }
  if (typeof authenticatedUserId !== "string" || !authenticatedUserId.trim()) {
    return { allowed: false, reason: "unauthenticated" };
  }
  if (organizationId !== undefined && organizationId !== null) {
    return { allowed: false, reason: "organization_context_forbidden" };
  }
  if (authenticatedUserId !== configuredOwnerUserId) {
    return { allowed: false, reason: "not_personal_owner" };
  }
  return { allowed: true };
}

module.exports = { authorizePersonalMt5 };
