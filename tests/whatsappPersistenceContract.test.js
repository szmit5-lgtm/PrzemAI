"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(path.join(__dirname, "../prisma/migrations/20261113225000_whatsapp_messages/migration.sql"), "utf8");
const model = schema.match(/model WhatsAppMessage\s*\{([\s\S]*?)\n\}/)?.[1];

test("WhatsApp message persistence has a tenant relation with cascading deletion", () => {
  assert.ok(model, "WhatsAppMessage Prisma model must exist");
  assert.match(model, /organizationId\s+String\b/);
  assert.match(model, /organization\s+Organization\s+@relation\(fields:\s*\[organizationId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE CASCADE/);
});

test("WhatsApp external message IDs are unique for webhook retry deduplication", () => {
  assert.match(model, /externalMessageId\s+String\s+@unique/);
  assert.match(migration, /CREATE UNIQUE INDEX "WhatsAppMessage_externalMessageId_key" ON "WhatsAppMessage"\("externalMessageId"\)/);
});

test("WhatsApp conversation queries have tenant-prefixed indexes", () => {
  assert.match(model, /@@index\(\[organizationId, receivedAt\]\)/);
  assert.match(model, /@@index\(\[organizationId, contactWaId, receivedAt\]\)/);
  assert.match(migration, /"WhatsAppMessage_organizationId_receivedAt_idx" ON "WhatsAppMessage"\("organizationId", "receivedAt"\)/);
  assert.match(migration, /"WhatsAppMessage_organizationId_contactWaId_receivedAt_idx" ON "WhatsAppMessage"\("organizationId", "contactWaId", "receivedAt"\)/);
});

test("WhatsApp incoming direction and timestamps agree between Prisma and SQL", () => {
  assert.match(model, /direction\s+String\s+@default\("INBOUND"\)/);
  assert.match(model, /receivedAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(migration, /"direction" TEXT NOT NULL DEFAULT 'INBOUND'/);
  assert.match(migration, /"receivedAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/);
});
