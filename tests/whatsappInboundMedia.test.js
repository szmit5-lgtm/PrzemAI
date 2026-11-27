"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { whatsAppContent, draftForMessage } = require("../api/services/WhatsAppInboundService");
const { evaluateOutbound } = require("../api/services/WhatsAppPolicy");

test("WhatsApp keeps bounded captions and public descriptions of documents and voice", () => {
  const document = whatsAppContent({
    document: { caption: "X".repeat(8000), filename: "folder/raport\n.pdf",
      mime_type: "application/pdf", id: "private-meta-id", sha256: "private-checksum",
      url: "https://untrusted.test" }
  }, "document");
  assert.equal(document.text.length, 4096);
  assert.deepEqual(document.metadata, { attachment: { kind: "document",
    fileName: "folder_raport_.pdf", mime: "application/pdf" } });
  assert.deepEqual(whatsAppContent({
    audio: { voice: true, mime_type: "audio/ogg", id: "voice-id" }
  }, "audio"), { text: null, metadata: { attachment: { kind: "audio",
    voice: true, mime: "audio/ogg" } } });
  assert.deepEqual(whatsAppContent({ audio: [] }, "audio"), { text: null });
  assert.deepEqual(whatsAppContent({ text: { body: "Pytanie" } }, "text"), { text: "Pytanie" });
});

test("media-aware replies are previews only and remain blocked for sending", () => {
  const voice = draftForMessage("audio");
  const document = draftForMessage("document");
  assert.match(voice, /nagranie/);
  assert.match(document, /załącznik/);
  assert.equal(evaluateOutbound({ text: voice, globalPaused: true }).sendAuthorized, false);
});

test("signed WhatsApp webhook and scoped inbox expose media descriptions without a provider call", async t => {
  const { createHmac } = require("node:crypto");
  const express = require("express");
  const jwt = require("jsonwebtoken");
  const records = [];
  const org = "company-a";
  const contact = "48123456789";
  const secret = "synthetic-signing-key-only";
  const phone = "synthetic-phone";
  for (const [name, value] of Object.entries({
    JWT_SECRET: "synthetic-session-key-only",
    WHATSAPP_ORGANIZATION_ID: org, WHATSAPP_APP_SECRET: secret, WHATSAPP_PHONE_NUMBER_ID: phone
  })) {
    const original = process.env[name];
    process.env[name] = value;
    t.after(() => { if (original === undefined) delete process.env[name]; else process.env[name] = original; });
  }
  global.prisma = {
    organization: { findFirst: async ({ where }) => where.id === org ? { id: org } : null },
    organizationMembership: { findFirst: async ({ where }) =>
      where.userId === "authorized" && where.organizationId === org ? { id: "membership" } : null },
    whatsAppMessage: {
      create: async ({ data }) => records.push({ id: "stored", ...data }),
      findMany: async ({ where }) => {
        assert.deepEqual(where, { organizationId: org, contactWaId: contact });
        return records;
      },
      findFirst: async ({ where }) => {
        assert.deepEqual(where, { organizationId: org, contactWaId: contact, direction: "INBOUND" });
        return records[0];
      }
    }
  };
  const app = express();
  app.use(express.json({ verify(req, _res, body) { req.rawBody = body; } }));
  app.use(require("../api/routes/whatsappRoutes"));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{
    field: "messages", value: { metadata: { phone_number_id: phone }, messages: [{
      id: "wamid.synthetic+id/==", from: contact, type: "audio", audio: { mime_type: "audio/ogg", voice: true, id: "keep-private" }
    }] }
  }] }] });
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const delivery = await fetch(base + "/webhook", { method: "POST",
    headers: { "Content-Type": "application/json", "x-hub-signature-256": sig }, body });
  assert.equal(delivery.status, 200);
  assert.equal(records.length, 1);
  // A previously stored provider ID must not cross the inbox boundary.
  records[0].metadata.attachment.providerID = "keep-private";
  const auth = id => ({ Authorization: "Bearer " + jwt.sign({ id }, process.env.JWT_SECRET) });
  const path = "/organizations/" + org;
  const requestInbox = headers => fetch(base + path + "/messages?contact=" + contact, { headers });
  const blocked = await requestInbox(auth("outsider"));
  assert.equal(blocked.status, 403);
  const inbox = await requestInbox(auth("authorized"));
  assert.deepEqual((await inbox.json()).data[0].attachment, { kind: "audio", mime: "audio/ogg", voice: true });
  const draft = await fetch(base + path + "/draft-preview", { method: "POST",
    headers: { ...auth("authorized"), "Content-Type": "application/json" }, body: JSON.stringify({ contactWaId: contact }) });
  const reply = await draft.json();
  assert.match(reply.draft, /nagranie/);
  assert.equal(reply.sent, false);
  assert.equal(reply.policy.sendAuthorized, false);
});
