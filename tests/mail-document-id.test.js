"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mailDocumentId = require("../lib/mailDocumentId");

const original = {
  integrationId: "mailbox-1",
  messageId: "<invoice-123@example.test>",
  uid: 10,
  uidValidity: "55",
  filename: "invoice.pdf",
  attachmentIndex: 0
};

test("same mail attachment produces the same opaque id on every sync", () => {
  const first = mailDocumentId(original);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(mailDocumentId({ ...original }), first);
  assert.doesNotMatch(first, /invoice-123|mailbox-1/);
});

test("two attachments with the same name are not merged", () => {
  assert.notEqual(
    mailDocumentId(original),
    mailDocumentId({ ...original, attachmentIndex: 1 })
  );
});

test("same message-id in two mailboxes is not merged", () => {
  assert.notEqual(
    mailDocumentId(original),
    mailDocumentId({ ...original, integrationId: "mailbox-2" })
  );
});

test("fallback UID includes UIDVALIDITY when Message-ID is absent", () => {
  const fallback = { ...original, messageId: null };
  assert.notEqual(
    mailDocumentId(fallback),
    mailDocumentId({ ...fallback, uidValidity: "56" })
  );
  assert.notEqual(
    mailDocumentId(fallback),
    mailDocumentId({ ...fallback, uid: 11 })
  );
});

test("rejects incomplete identity instead of creating colliding keys", () => {
  assert.throws(
    () => mailDocumentId({ ...original, integrationId: "" }),
    /Invalid/
  );
  assert.throws(
    () => mailDocumentId({ ...original, messageId: null, uid: null }),
    /neither/
  );
});
