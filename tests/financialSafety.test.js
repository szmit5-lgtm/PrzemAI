"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const mailDocumentId = require("../lib/mailDocumentId");
const { isAuthorizedDekonicaUser, canSyncMailIntegration } = require("../lib/mailAccessPolicy");

function attachment(overrides = {}) {
  return {
    integrationId: "integration-1",
    messageId: "<invoice-123@example.com>",
    uid: 123,
    uidValidity: "999",
    filename: "faktura.pdf",
    attachmentIndex: 0,
    ...overrides
  };
}

function integration(config = {}) {
  return {
    type: "MAIL",
    provider: "HOME_PL",
    config: {
      email: "office@dekonica.com",
      passwordEnv: "DEKONICA_MAIL_PASSWORD",
      ...config
    }
  };
}

test("mail attachment IDs are stable and opaque", () => {
  const first = mailDocumentId(attachment());
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, mailDocumentId(attachment()));
  assert.notEqual(first, mailDocumentId(attachment({ attachmentIndex: 1 })));
  assert.notEqual(first, mailDocumentId(attachment({ integrationId: "integration-2" })));
  assert.notEqual(first, mailDocumentId(attachment({ filename: "inna.pdf" })));
});

test("mail attachment IDs use UID and UIDVALIDITY when Message-ID is absent", () => {
  const base = attachment({ messageId: null });
  assert.equal(mailDocumentId(base), mailDocumentId(base));
  assert.notEqual(mailDocumentId(base), mailDocumentId({ ...base, uidValidity: "1000" }));
  assert.notEqual(mailDocumentId(base), mailDocumentId({ ...base, uid: 124 }));
});

test("mail attachment identity rejects missing message identity or index", () => {
  assert.throws(() => mailDocumentId(attachment({ messageId: null, uid: null })));
  assert.throws(() => mailDocumentId(attachment({ attachmentIndex: -1 })));
  assert.throws(() => mailDocumentId(attachment({ integrationId: "" })));
});

test("shared mailbox access requires an explicit matching internal user ID", () => {
  const owner = "user-owner";
  const env = { DEKONICA_MAIL_OWNER_USER_ID: owner };
  assert.equal(isAuthorizedDekonicaUser(owner, env), true);
  assert.equal(isAuthorizedDekonicaUser("other-user", env), false);
  assert.equal(isAuthorizedDekonicaUser(owner, {}), false);
  assert.equal(canSyncMailIntegration(owner, integration(), env), true);
  assert.equal(canSyncMailIntegration("other-user", integration(), env), false);
  assert.equal(canSyncMailIntegration(owner, integration(), {}), false);
});

test("shared mailbox policy cannot be bypassed by changing only one field", () => {
  const env = { DEKONICA_MAIL_OWNER_USER_ID: "user-owner" };
  const changedAddress = integration({ email: "other@example.com" });
  const changedSecret = integration({ passwordEnv: "OTHER_PASSWORD" });
  assert.equal(canSyncMailIntegration("user-owner", changedAddress, env), false);
  assert.equal(canSyncMailIntegration("user-owner", changedSecret, env), false);
  assert.equal(canSyncMailIntegration("other-user", changedAddress, env), false);
  assert.equal(canSyncMailIntegration("other-user", changedSecret, env), false);
});

test("unprovisioned private mailboxes cannot select arbitrary environment secrets", () => {
  const privateMailbox = integration({
    email: "private@example.com",
    passwordEnv: "PRIVATE_MAIL_PASSWORD"
  });
  const env = { DEKONICA_MAIL_OWNER_USER_ID: "user-1" };
  assert.equal(canSyncMailIntegration("user-1", privateMailbox, env), false);
  assert.equal(canSyncMailIntegration("user-1", privateMailbox, {}), false);
  assert.equal(canSyncMailIntegration("user-1", { ...privateMailbox, type: "KSEF" }, env), false);
  assert.equal(canSyncMailIntegration("user-1", null, env), false);
});
