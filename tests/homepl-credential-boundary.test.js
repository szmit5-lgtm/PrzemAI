"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const clients = [];
class FakeImapFlow {
  constructor(options) {
    clients.push(options);
  }
}

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/connectors/mail/HomePlMailConnector.js")) {
    if (request === "imapflow") return { ImapFlow: FakeImapFlow };
    if (request === "mailparser") return { simpleParser: async () => ({}) };
  }
  return originalLoad.call(this, request, parent, isMain);
};

let HomePlMailConnector;
try {
  HomePlMailConnector = require("../connectors/mail/HomePlMailConnector");
} finally {
  Module._load = originalLoad;
}

const valid = {
  email: "office@dekonica.com",
  passwordEnv: "DEKONICA_MAIL_PASSWORD",
  imapHost: "dekonica.com",
  imapPort: 993
};

test("connector refuses arbitrary environment secret names before IMAP creation", () => {
  const old = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "sensitive-test-value";
  try {
    clients.length = 0;
    for (const passwordEnv of ["JWT_SECRET", "DATABASE_URL", "OTHER_SECRET"]) {
      assert.throws(
        () => new HomePlMailConnector({
          ...valid,
          email: "attacker@example.invalid",
          passwordEnv,
          imapHost: "attacker.example.invalid"
        }).createClient(),
        /not provisioned/
      );
    }
    assert.equal(clients.length, 0);
  } finally {
    if (old === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = old;
  }
});

test("connector uses only trusted IMAP host and TLS even if database host is forged", () => {
  const oldPassword = process.env.DEKONICA_MAIL_PASSWORD;
  const oldHost = process.env.DEKONICA_MAIL_IMAP_HOST;
  process.env.DEKONICA_MAIL_PASSWORD = "dummy-test-mail-password";
  process.env.DEKONICA_MAIL_IMAP_HOST = "serwer123.home.pl";
  try {
    clients.length = 0;
    new HomePlMailConnector({
      ...valid,
      imapHost: "attacker.example.invalid",
      imapPort: 143
    }).createClient();
    assert.equal(clients.length, 1);
    const options = clients[0];
    assert.equal(options.host, "serwer123.home.pl");
    assert.equal(options.port, 993);
    assert.equal(options.secure, true);
    assert.equal(options.tls.servername, "serwer123.home.pl");
    assert.equal(options.tls.rejectUnauthorized, true);
    assert.equal(options.auth.user, "office@dekonica.com");
    assert.equal(options.auth.pass, "dummy-test-mail-password");
    assert.equal(options.logger, false);
  } finally {
    if (oldPassword === undefined) delete process.env.DEKONICA_MAIL_PASSWORD;
    else process.env.DEKONICA_MAIL_PASSWORD = oldPassword;
    if (oldHost === undefined) delete process.env.DEKONICA_MAIL_IMAP_HOST;
    else process.env.DEKONICA_MAIL_IMAP_HOST = oldHost;
  }
});

test("connector rejects malformed trusted server configuration", () => {
  const oldPassword = process.env.DEKONICA_MAIL_PASSWORD;
  const oldHost = process.env.DEKONICA_MAIL_IMAP_HOST;
  process.env.DEKONICA_MAIL_PASSWORD = "dummy-test-mail-password";
  process.env.DEKONICA_MAIL_IMAP_HOST = "https://attacker.example.invalid/path";
  try {
    clients.length = 0;
    assert.throws(
      () => new HomePlMailConnector(valid).createClient(),
      /server configuration is invalid/
    );
    assert.equal(clients.length, 0);
  } finally {
    if (oldPassword === undefined) delete process.env.DEKONICA_MAIL_PASSWORD;
    else process.env.DEKONICA_MAIL_PASSWORD = oldPassword;
    if (oldHost === undefined) delete process.env.DEKONICA_MAIL_IMAP_HOST;
    else process.env.DEKONICA_MAIL_IMAP_HOST = oldHost;
  }
});

test("missing or partial mailbox config fails closed without reading secrets", () => {
  clients.length = 0;
  for (const config of [undefined, null, {}, { email: "office@dekonica.com" }]) {
    assert.throws(
      () => new HomePlMailConnector(config).createClient(),
      /not provisioned/
    );
  }
  assert.equal(clients.length, 0);
});
