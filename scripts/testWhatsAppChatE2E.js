"use strict";

const assert = require("node:assert/strict");
const { randomUUID, randomInt, createHmac } = require("node:crypto");
const { once } = require("node:events");

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);

  const db = require("../lib/prisma");
  const chat = require("../api/services/ChatService");
  const jwt = require("jsonwebtoken");
  const express = require("express");
  const contact = "48123456789";
  const prompts = [];
  chat.ai.ask = async ({ user }) => {
    try { prompts.push(JSON.parse(user)); } catch { prompts.push(user); }
    return "Odpowiedź z mocka";
  };
  chat.ai.extractMemories = async () => { throw new Error("Company chat must not extract personal memories"); };
  process.env.JWT_SECRET = randomUUID();
  process.env.WHATSAPP_APP_SECRET = randomUUID();
  process.env.WHATSAPP_PHONE_NUMBER_ID = "700";
  const app = express();
  app.use(express.json({ verify: (req, _res, raw) => { req.rawBody = raw; } }));
  app.use(require("../api/routes/whatsappRoutes"));
  app.use("/api/chat", require("../api/routes/chatRoutes"));
  const telegram = require("../api/services/TelegramBridgeService");
  const telegramReplies = [];
  telegram.sendTelegramMessage = async answer => { telegramReplies.push(answer); };
  process.env.TELEGRAM_WEBHOOK_SECRET = randomUUID();
  app.use("/api/telegram", require("../api/routes/telegramRoutes"));
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const [owner, other] = await Promise.all([1, 2].map(() => db.user.create({
      data: { email: randomUUID() + "@example.test", password: "unused" }
    })));
    const org = await db.organization.create({ data: {
      name: "Local WA", slug: randomUUID(),
      memberships: { create: [{ userId: owner.id, role: "OWNER" }, { userId: other.id, role: "MEMBER" }] }
    } });
    process.env.WHATSAPP_ORGANIZATION_ID = org.id;
    const prefix = `/organizations/${org.id}`;

    async function post(path, body, headers) {
      return fetch(base + path, { method: "POST", body, headers: {
        "content-type": "application/json", ...headers
      } });
    }
    function authenticated(path, user, data) {
      return post(prefix + path, JSON.stringify(data), {
        authorization: "Bearer " + jwt.sign({ id: user.id }, process.env.JWT_SECRET)
      });
    }
    function webhook(fields, { valid = true, phone = "700" } = {}) {
      const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{
        field: "messages", value: { metadata: { phone_number_id: phone }, ...fields }
      }] }] });
      return post("/webhook", body, { "x-hub-signature-256": "sha256=" + createHmac("sha256",
        valid ? process.env.WHATSAPP_APP_SECRET : "invalid").update(body).digest("hex") });
    }
    function message(text, from = contact) {
      return { id: "wamid." + randomUUID() + "+/=", from, type: "text", text: { body: text } };
    }
    function draft(user = owner, contactWaId = contact) {
      return authenticated("/draft-preview", user, { contactWaId });
    }

    const initial = message("Wiadomość przed powiązaniem");
    assert.equal((await webhook({ messages: [initial] }, { valid: false })).status, 403);
    assert.equal((await webhook({ messages: [initial] }, { phone: "701" })).status, 200);
    assert.equal(await db.whatsAppMessage.count({ where: { organizationId: org.id } }), 0);
    assert.equal((await webhook({ statuses: [{ status: "delivered" }] })).status, 200);
    assert.equal((await webhook({ messages: [initial, { ...initial, from: "bad" }] })).status, 400);
    assert.equal(await db.whatsAppMessage.count({ where: { organizationId: org.id } }), 0);
    assert.equal((await webhook({ messages: [initial] })).status, 200);
    assert.equal((await draft()).status, 403);

    const linked = await authenticated("/link-code", owner, {});
    assert.equal(linked.status, 201);
    const { data: link } = await linked.json();
    const pairing = message(link.text);
    assert.equal((await webhook({ messages: [pairing] })).status, 200);
    assert.equal((await webhook({ messages: [message(link.text, "48123456780")] })).status, 200);
    assert.equal(await db.history.count({ where: { userId: owner.id, type: "WHATSAPP_BINDING" } }), 1);
    assert.equal((await db.whatsAppMessage.findUnique({ where: { externalMessageId: pairing.id } })).text, null);

    assert.equal((await draft()).status, 403);

    const natural = message("Dzień dobry, nazywam się Jan");
    assert.deepEqual((await Promise.all([webhook({ messages: [natural] }), webhook({ messages: [natural] })]))
      .map(response => response.status), [200, 200]);
    assert.equal(await db.whatsAppMessage.count({ where: { externalMessageId: natural.id } }), 1);
    assert.equal((await draft(other)).status, 403);
    const first = await draft();
    assert.equal(first.status, 200);
    assert.equal((await first.json()).sent, false);
    assert.equal((await draft()).status, 200);
    assert.equal(prompts.length, 1);

    assert.equal((await webhook({ messages: [message("Czy pamiętasz moje imię?")] })).status, 200);
    const next = await draft();
    assert.equal(next.status, 200);
    assert.equal((await next.json()).draft, "Odpowiedź z mocka");
    assert.match(JSON.stringify(prompts[1].conversation), /nazywam się Jan/);
    assert.equal(await db.chatMessage.count({ where: {
      conversation: { channel: "WHATSAPP", userId: owner.id }
    } }), 4);
    assert.deepEqual(await chat.listConversations(owner.id), []);

    await db.agent.create({ data: { userId: owner.id, key: "investment", name: "Investment", type: "INVESTMENT" } });
    await db.organizationInvestment.create({ data: { organizationId: org.id, name: "Uprawniona inwestycja" } });
    const outside = await db.organization.create({ data: { name: "Outside", slug: randomUUID() } });
    await db.organizationInvestment.create({ data: { organizationId: outside.id, name: "Obca inwestycja" } });
    assert.equal((await webhook({ messages: [message("Przeanalizuj inwestycje")] })).status, 200);
    const generalDraft = await draft();
    assert.equal(generalDraft.status, 200);
    assert.match((await generalDraft.json()).draft, /Investment Agent/);
    assert.match(JSON.stringify(prompts[2].records), /Uprawniona inwestycja/);
    assert.doesNotMatch(JSON.stringify(prompts[2].records), /Obca inwestycja/);

    await db.organizationMembership.updateMany({
      where: { userId: owner.id, organizationId: org.id }, data: { status: "REVOKED" }
    });
    assert.equal((await draft()).status, 403);
    assert.equal(prompts.length, 3);
    await db.organizationMembership.updateMany({
      where: { userId: owner.id, organizationId: org.id }, data: { status: "ACTIVE" }
    });
    const webAuth = { authorization: "Bearer " + jwt.sign({ id: owner.id }, process.env.JWT_SECRET) };
    const web = await post("/api/chat", JSON.stringify({
      organizationId: org.id, message: "Rozpoczęcie wspólnego wątku WWW", requestId: randomUUID()
    }), webAuth);
    assert.equal(web.status, 200);
    const { conversationId } = await web.json();
    const telegramId = randomInt(100000, 2 ** 32);
    async function telegramUpdate(message_id, text) {
      return post("/api/telegram/webhook", JSON.stringify({ update_id: message_id, message: {
        message_id, text, from: { id: telegramId }, chat: { id: telegramId, type: "private" }
      } }), { "X-Telegram-Bot-Api-Secret-Token": process.env.TELEGRAM_WEBHOOK_SECRET });
    }
    const pairCode = await telegram.createLink({ userId: owner.id });
    assert.equal((await telegramUpdate(1, "/start " + pairCode.code)).status, 200);
    assert.equal((await telegramUpdate(2, `/watek ${conversationId} Dane bez zakresu`)).status, 200);
    assert.match(telegramReplies.at(-1).text, /Nie znaleziono/);
    assert.equal((await telegramUpdate(3, "/spolka " + org.slug)).status, 200);
    assert.equal((await telegramUpdate(4, `/watek ${conversationId} Kontynuacja Telegram`)).status, 200);
    assert.equal(telegramReplies.at(-1).text, "Odpowiedź z mocka");

    assert.equal((await webhook({ messages: [message("Kontynuacja WhatsApp")] })).status, 200);
    assert.equal((await authenticated("/draft-preview", other, { contactWaId: contact, conversationId })).status, 403);
    assert.equal((await authenticated("/draft-preview", owner, { contactWaId: contact, conversationId: "unknown" })).status, 403);
    const shared = await authenticated("/draft-preview", owner, { contactWaId: contact, conversationId });
    assert.equal(shared.status, 200);
    assert.equal((await shared.json()).sent, false);
    assert.match(JSON.stringify(prompts.at(-1)), /Kontynuacja Telegram/);

    const stored = await fetch(base + "/api/chat/" + conversationId, { headers: webAuth });
    const turns = (await stored.json()).conversation.messages.filter(row => row.role === "user");
    assert.deepEqual(turns.map(row => row.metadata?.sharedChannel || "WEB"), ["WEB", "TELEGRAM", "WHATSAPP"]);
    await db.organizationMembership.updateMany({
      where: { userId: owner.id, organizationId: org.id }, data: { status: "REVOKED" }
    });
    const revokedThread = await fetch(base + "/api/chat/" + conversationId, { headers: webAuth });
    assert.doesNotMatch(JSON.stringify(await revokedThread.json()), /Kontynuacja (Telegram|WhatsApp)/);

    console.log("WhatsApp webhook and shared WWW–Telegram–WhatsApp thread E2E passed");
  } finally {
    server.close();
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
