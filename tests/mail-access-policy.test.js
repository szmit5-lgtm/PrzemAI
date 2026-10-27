"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isAuthorizedDekonicaUser,
  canSyncMailIntegration
} = require("../lib/mailAccessPolicy");

const shared = {
  type: "MAIL",
  provider: "HOME_PL",
  config: {
    email: "office@dekonica.com",
    passwordEnv: "DEKONICA_MAIL_PASSWORD"
  }
};
const ownerEnv = { DEKONICA_MAIL_OWNER_USER_ID: "user-123" };

test("shared mailbox fails closed without an explicit owner ID", () => {
  assert.equal(isAuthorizedDekonicaUser("user-123", {}), false);
  assert.equal(canSyncMailIntegration("user-123", shared, {}), false);
  assert.equal(canSyncMailIntegration("office@dekonica.com", shared, {}), false);
});

test("only the configured immutable user ID can access the shared mailbox", () => {
  assert.equal(canSyncMailIntegration("user-123", shared, ownerEnv), true);
  assert.equal(canSyncMailIntegration("user-456", shared, ownerEnv), false);
  assert.equal(isAuthorizedDekonicaUser("user-123", {
    DEKONICA_MAIL_OWNER_USER_ID: " user-123 "
  }), true);
});

test("unverified matching email cannot grant mailbox access", () => {
  assert.equal(canSyncMailIntegration("owner@example.test", shared, {
    DEKONICA_MAIL_OWNER_EMAIL: "owner@example.test"
  }), false);
});

test("changing mailbox or secret name does not bypass shared-mail policy", () => {
  assert.equal(canSyncMailIntegration("user-123", {
    ...shared,
    config: { ...shared.config, email: "other@example.test" }
  }, ownerEnv), false);
  assert.equal(canSyncMailIntegration("user-123", {
    ...shared,
    config: { ...shared.config, passwordEnv: "OTHER_SECRET" }
  }, ownerEnv), false);
});

test("separate non-shared mailbox integrations remain available", () => {
  assert.equal(canSyncMailIntegration("someone", {
    type: "MAIL",
    provider: "HOME_PL",
    config: { email: "someone@example.test", passwordEnv: "OTHER_SECRET" }
  }, {}), true);
  assert.equal(canSyncMailIntegration("someone", {
    type: "KSEF",
    provider: "HOME_PL",
    config: {}
  }, ownerEnv), false);
});
