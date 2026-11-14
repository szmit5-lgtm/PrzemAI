const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'prisma/migrations/20261113225000_whatsapp_messages/migration.sql'), 'utf8');
const model = schema.match(/model WhatsAppMessage\s*\{([\s\S]*?)\n\}/)?.[1];

test('WhatsApp persistence model and initial migration exist', () => {
  assert.ok(model, 'WhatsAppMessage Prisma model missing');
  assert.match(migration, /CREATE TABLE "WhatsAppMessage"/);
});

test('WhatsApp messages belong to an organization with cascade cleanup', () => {
  assert.match(model, /organizationId\s+String/);
  assert.match(model, /organization\s+Organization\s+@relation\(fields:\s*\[organizationId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE CASCADE/);
});

test('WhatsApp message deduplication is enforced by database constraint', () => {
  assert.match(model, /externalMessageId\s+String\s+@unique/);
  assert.match(migration, /CREATE UNIQUE INDEX "WhatsAppMessage_externalMessageId_key" ON "WhatsAppMessage"\("externalMessageId"\)/);
});

test('WhatsApp conversation indexes are tenant-scoped in model and migration', () => {
  assert.match(model, /@@index\(\[organizationId, receivedAt\]\)/);
  assert.match(model, /@@index\(\[organizationId, contactWaId, receivedAt\]\)/);
  assert.match(migration, /ON "WhatsAppMessage"\("organizationId", "receivedAt"\)/);
  assert.match(migration, /ON "WhatsAppMessage"\("organizationId", "contactWaId", "receivedAt"\)/);
});
