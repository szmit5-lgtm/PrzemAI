"use strict";

// Credentials are held in Railway, not in user-editable Integration.config.
// Until per-user credential provisioning exists, only the explicitly owned
// Dekonica mailbox may be synchronized.
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
  // Fail closed for every other secret name and mailbox. Previously, a
  // non-shared Integration could select arbitrary process.env keys, which
  // the IMAP connector would then send to a user-configured host.
  return isAuthorizedDekonicaUser(userId, env) &&
    normalizeEmail(config.email) === SHARED_MAILBOX &&
    config.passwordEnv === SHARED_PASSWORD_ENV;
}

module.exports = { isAuthorizedDekonicaUser, canSyncMailIntegration };
