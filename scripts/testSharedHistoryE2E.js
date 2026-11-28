"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createHmac, randomUUID } = require("node:crypto");

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);
  assert.equal(url.search + url.hash, "");

  const db = require("../lib/prisma");
  const express = require("express");
  const jwt = require("jsonwebtoken");
  const app = express();
  process.env.JWT_SECRET = randomUUID();
  const secret = randomUUID();
  process.env.WHATSAPP_APP_SECRET = secret;
  process.env.WHATSAPP_PHONE_NUMBER_ID = "test-phone";
  process.env.WHATSAPP_HISTORY_LINK_ENABLED = "true";
  app.use(express.json({ verify: (req, _res, bytes) => { req.rawBody = Buffer.from(bytes); } }));
  app.use("/api/whatsapp", require("../api/routes/whatsappRoutes"));
  app.use("/api/chat", require("../api/routes/chatRoutes"));
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port + "/api";
    const [owner, other] = await Promise.all(["owner", "other"].map(role => db.user.create({
      data: { email: role + "-" + randomUUID() + "@example.test", password: "synthetic" }
    })));
    const org = await db.organization.create({ data: {
      name: "Link E2E", slug: "link-" + randomUUID(),
      memberships: { create: { userId: owner.id, role: "OWNER" } }
    } });
    process.env.WHATSAPP_ORGANIZATION_ID = org.id;
    const thread = await db.chatConversation.create({ data: {
      userId: owner.id, title: "Historia firmowa",
      messages: { create: { role: "user", content: "Tekst z WWW", createdAt: new Date(0), metadata: { organizationId: org.id } } }
    } });
    const contact = "48123456789";
    const authenticated = (user, route, method, body) => fetch(base + route, {
      method, headers: { Authorization: "Bearer " + jwt.sign({ id: user.id }, process.env.JWT_SECRET),
        "Content-Type": "application/json" }, body: body && JSON.stringify(body)
    });
    const webhook = (text, id = "wamid." + randomUUID(), from = contact, key = secret) => {
      const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages",
        value: { metadata: { phone_number_id: "test-phone" }, messages: [{ id, from, timestamp: String(Math.floor(Date.now() / 1000) - 5), type: "text", text: { body: text } }] }
      }] }] });
      return fetch(base + "/whatsapp/webhook", { method: "POST", headers: {
        "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=" + createHmac("sha256", key).update(body).digest("hex")
      }, body });
    };
    const link = "/whatsapp/organizations/" + org.id + "/history-link";
    const details = "/chat/" + thread.id + "?organizationId=" + org.id;
    const request = { conversationId: thread.id, contact };
    assert.equal((await authenticated(other, link, "POST", request)).status, 403);
    const pairing = await authenticated(owner, link, "POST", request);
    assert.equal(pairing.status, 201);
    const { data: { message: code } } = await pairing.json();
    assert.equal((await webhook(code, undefined, contact, "wrong-signature")).status, 403);
    assert.equal((await webhook(code, undefined, "48987654321")).status, 200);
    assert.equal((await webhook("Przed powiązaniem")).status, 200);
    assert.equal((await webhook(code)).status, 200);
    const delivery = "wamid." + randomUUID();
    for (let i = 0; i < 2; i++) assert.equal((await webhook("Tekst z WhatsApp", delivery)).status, 200);

    const { handleCommand } = require("../api/services/TelegramBridgeService");
    const telegramUserId = String(Number.parseInt(randomUUID().replace(/-/g, "").slice(0, 7), 16) + 1000);
    await db.history.create({ data: { userId: owner.id, type: "TELEGRAM_LINK", title: "Test",
      filename: "", report: { status: "LINKED", telegramUserId } } });
    await db.telegramChatSelection.create({ data: { userId: owner.id, telegramUserId, organizationId: org.id } });
    const telegramId = Number(telegramUserId);
    const reply = await handleCommand({ db, update: { message: {
      text: "/watek " + thread.id + " Tekst z Telegrama", message_id: 1,
      from: { id: telegramId }, chat: { id: telegramId, type: "private" }
    } }, chat: async (userId, content, id, options) => {
      assert.equal(userId, owner.id);
      assert.equal(id, thread.id);
      assert.equal(options.organizationId, org.id);
      assert.equal(options.sharedWebThread, true);
      await db.chatMessage.create({ data: { conversationId: id, role: "user", content, metadata: { organizationId: org.id } } });
      return { answer: "Odpowiedź syntetyczna" };
    } });
    assert.equal(reply.text, "Odpowiedź syntetyczna");

    const response = await authenticated(owner, details, "GET");
    assert.equal(response.status, 200);
    const { conversation } = await response.json();
    assert.deepEqual(conversation.messages.map(item => item.content), ["Tekst z WWW", "Tekst z WhatsApp", "Tekst z Telegrama"]);
    assert.equal((await authenticated(other, details, "GET")).status, 403);
    assert.equal(await db.whatsAppMessage.count({ where: { organizationId: org.id } }), 1);
    assert.equal((await authenticated(owner, link, "DELETE", request)).status, 200);
    assert.equal((await webhook("Tekst z WhatsApp", delivery)).status, 200);
    assert.equal((await webhook("Po odłączeniu")).status, 200);
    assert.equal(await db.whatsAppMessage.count({ where: { organizationId: org.id } }), 2);
    assert.equal(await db.chatMessage.count({ where: { conversationId: thread.id } }), 3);
    console.log("Shared history E2E: signed provider identity, scopes, replay, revocation, no sends");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
