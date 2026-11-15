"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Offline safety regression: never connects to Railway or a production database.
const migration = fs.readFileSync(
  path.join(__dirname, "../prisma/migrations/20261113225000_whatsapp_messages/migration.sql"),
  "utf8"
);
const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");

test("WhatsApp persistence has a unique external event ID for webhook retry deduplication", () => {
  assert.match(migration, /CREATE UNIQUE INDEX "WhatsAppMessage_externalMessageId_key" ON "WhatsAppMessage"\("externalMessageId"\)/);
  assert.match(schema, /externalMessageId\s+String\s+@unique/);
});

test("WhatsApp conversation queries can be scoped to organization and contact", () => {
  assert.match(migration, /"organizationId" TEXT NOT NULL/);
  assert.match(migration, /"contactWaId" TEXT NOT NULL/);
  assert.match(migration, /CREATE INDEX "WhatsAppMessage_organizationId_contactWaId_receivedAt_idx" ON "WhatsAppMessage"\("organizationId", "contactWaId", "receivedAt"\)/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\)/);
});

test("WhatsApp messages preserve direction, timestamps and optional metadata", () => {
  assert.match(migration, /"direction" TEXT NOT NULL DEFAULT 'INBOUND'/);
  assert.match(migration, /"receivedAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/);
  assert.match(migration, /"metadata" JSONB/);
});
