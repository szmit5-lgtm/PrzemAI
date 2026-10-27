"use strict";

// The shared DEKONICA_MAIL_PASSWORD is not a per-user credential.
// Self-registration does not verify ownership of an email address,
// so authorize only an existing, explicitly configured internal user ID.
const SHARED_MAILBOX = "office@dekonica.com";
const SHARED_PASSWORD_ENV = "DEKONICA_MAIL_PASSWORD";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isAuthorizedDekonicaUser(userId, env = process.env) {
  const ownerId = env.DEKONICA_MAIL_OWNER_USER_ID;
  return typeof ownerId === "string" && ownerId.trim().length > 0 &&
    typeof userId === "string" && userId === ownerId.trim();
}

function canSyncMailIntegration(userId, integration, env = process.env) {
  if (!integration || integration.type !== "MAIL" ||
      integration.provider !== "HOME_PL") return false;

  const config = integration.config || {};
  const mailbox = normalizeEmail(config.email);
  const passwordEnv = config.passwordEnv;

  // Either reference to the shared mailbox or its secret invokes the
  // stricter policy. Prevent swapping just one field to bypass it.
  if (mailbox === SHARED_MAILBOX ||
      passwordEnv === SHARED_PASSWORD_ENV) {
    return isAuthorizedDekonicaUser(userId, env) &&
      mailbox === SHARED_MAILBOX &&
      passwordEnv === SHARED_PASSWORD_ENV;
  }

  return true;
}

module.exports = { isAuthorizedDekonicaUser, canSyncMailIntegration };
