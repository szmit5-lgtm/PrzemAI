"use strict";

// The DEKONICA_MAIL_PASSWORD variable is shared infrastructure, not a
// per-user credential. Never give arbitrary self-registered accounts access
// to the shared company mailbox. Fail closed until the owner is configured.
const SHARED_MAILBOX = "office@dekonica.com";
const SHARED_PASSWORD_ENV = "DEKONICA_MAIL_PASSWORD";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isAuthorizedDekonicaUser(userEmail, env = process.env) {
  const owner = normalizeEmail(env.DEKONICA_MAIL_OWNER_EMAIL);
  return Boolean(owner) && normalizeEmail(userEmail) === owner;
}

function canSyncMailIntegration(userEmail, integration, env = process.env) {
  if (!integration || integration.type !== "MAIL" ||
      integration.provider !== "HOME_PL") return false;

  const config = integration.config || {};
  const mailbox = normalizeEmail(config.email);
  const passwordEnv = config.passwordEnv;

  // Either reference to the shared mailbox or its secret invokes the
  // stricter policy. Prevent swapping just one field to bypass it.
  if (mailbox === SHARED_MAILBOX ||
      passwordEnv === SHARED_PASSWORD_ENV) {
    return isAuthorizedDekonicaUser(userEmail, env) &&
      mailbox === SHARED_MAILBOX &&
      passwordEnv === SHARED_PASSWORD_ENV;
  }

  return true;
}

module.exports = { isAuthorizedDekonicaUser, canSyncMailIntegration };
