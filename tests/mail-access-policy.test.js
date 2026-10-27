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
const ownerEnv = { DEKONICA_MAIL_OWNER_EMAIL: "Owner@Example.test" };

test("shared mailbox fails closed without an explicit owner", () => {
  assert.equal(isAuthorizedDekonicaUser("owner@example.test", {}), false);
  assert.equal(canSyncMailIntegration("owner@example.test", shared, {}), false);
  assert.equal(canSyncMailIntegration("office@dekonica.com", shared, {}), false);
});

test("only the configured account can access the shared mailbox", () => {
  assert.equal(
    canSyncMailIntegration(" OWNER@example.test ", shared, ownerEnv), true
  );
  assert.equal(
    canSyncMailIntegration("other@example.test", shared, ownerEnv), false
  );
});

test("changing mailbox or secret name does not bypass shared-mail policy", () => {
  assert.equal(canSyncMailIntegration("owner@example.test", {
    ...shared,
    config: { ...shared.config, email: "other@example.test" }
  }, ownerEnv), false);
  assert.equal(canSyncMailIntegration("owner@example.test", {
    ...shared,
    config: { ...shared.config, passwordEnv: "OTHER_SECRET" }
  }, ownerEnv), false);
});

test("separate non-shared mailbox integrations remain available", () => {
  assert.equal(canSyncMailIntegration("someone@example.test", {
    type: "MAIL",
    provider: "HOME_PL",
    config: { email: "someone@example.test", passwordEnv: "OTHER_SECRET" }
  }, {}), true);
  assert.equal(canSyncMailIntegration("someone@example.test", {
    type: "KSEF",
    provider: "HOME_PL",
    config: {}
  }, ownerEnv), false);
});
