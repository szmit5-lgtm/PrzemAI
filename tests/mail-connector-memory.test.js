"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let clientOptions;
let released = false;
let loggedOut = false;

class FakeImapFlow {
  constructor(options) {
    clientOptions = options;
    this.mailbox = { exists: 1, uidValidity: 42 };
  }
  async connect() {}
  async getMailboxLock(name) {
    assert.equal(name, "INBOX");
    return { release() { released = true; } };
  }
  async *fetch() {
    yield { uid: 123, source: Buffer.from("fake email"), internalDate: new Date("2026-10-01") };
  }
  async logout() { loggedOut = true; }
}

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/connectors/mail/HomePlMailConnector.js")) {
    if (request === "imapflow") return { ImapFlow: FakeImapFlow };
    if (request === "mailparser") return {
      simpleParser: async () => ({
        messageId: "<test@example.com>",
        subject: "Invoice",
        text: "Private email body",
        attachments: [{
          filename: "invoice.pdf",
          contentType: "application/pdf",
          size: 6,
          content: Buffer.from("ABCDEF")
        }]
      })
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let HomePlMailConnector;
try {
  HomePlMailConnector = require("../connectors/mail/HomePlMailConnector");
} finally {
  Module._load = originalLoad;
}

test("IMAP connector bounds connection time and returns metadata without retaining content", async () => {
  const previous = process.env.DEKONICA_MAIL_PASSWORD;
  process.env.DEKONICA_MAIL_PASSWORD = "dummy-not-a-real-password";
  try {
    const connector = new HomePlMailConnector({
      email: "office@dekonica.com",
      imapHost: "mail.example.com",
      imapPort: 993,
      passwordEnv: "DEKONICA_MAIL_PASSWORD"
    });
    const messages = await connector.fetchRecentMessages(1);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].attachments[0].filename, "invoice.pdf");
    assert.equal(messages[0].attachments[0].size, 6);
    assert.equal(Object.hasOwn(messages[0], "text"), false);
    assert.equal(Object.hasOwn(messages[0].attachments[0], "content"), false);
    assert.equal(clientOptions.connectionTimeout, 20000);
    assert.equal(clientOptions.greetingTimeout, 15000);
    assert.equal(clientOptions.socketTimeout, 60000);
    assert.equal(released, true);
    assert.equal(loggedOut, true);
  } finally {
    if (previous === undefined) delete process.env.DEKONICA_MAIL_PASSWORD;
    else process.env.DEKONICA_MAIL_PASSWORD = previous;
  }
});

test("IMAP connector refuses unbounded message batches", async () => {
  const connector = new HomePlMailConnector({});
  await assert.rejects(() => connector.fetchRecentMessages(0), /limit/);
  await assert.rejects(() => connector.fetchRecentMessages(51), /limit/);
  await assert.rejects(() => connector.fetchRecentMessages(1.5), /limit/);
});
