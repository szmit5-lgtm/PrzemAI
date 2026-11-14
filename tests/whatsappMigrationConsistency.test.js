"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "prisma/migrations/20261113225000_whatsapp_messages/migration.sql"), "utf8"
);

test("WhatsAppMessage schema and SQL migration retain tenant-scoped conversation indexes", () => {
  const model = schema.match(/model WhatsAppMessage\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(model, "WhatsAppMessage model must exist");
  for (const field of ["organizationId", "externalMessageId", "phoneNumberId", "contactWaId", "messageType", "receivedAt"]) {
    assert.match(model, new RegExp("^\\s*" + field + "\\s+", "m"));
    assert.match(migration, new RegExp('"' + field + '"'));
  }
  assert.match(model, /externalMessageId\s+String\s+@unique/);
  assert.match(migration, /CREATE UNIQUE INDEX "WhatsAppMessage_externalMessageId_key"/);
  assert.match(model, /@@index\(\[organizationId, contactWaId, receivedAt\]\)/);
  assert.match(migration, /CREATE INDEX "WhatsAppMessage_organizationId_contactWaId_receivedAt_idx"/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE CASCADE/);
});

test("WhatsApp persistence does not silently migrate messages into a user-owned finance table", () => {
  assert.match(schema, /whatsappMessages\s+WhatsAppMessage\[\]/);
  assert.match(schema, /organization\s+Organization\s+@relation\(fields: \[organizationId\]/);
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM)\s+"(?:FinancialDocument|User|Organization)"/i);
});
