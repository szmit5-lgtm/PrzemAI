"use strict";

const assert = require("node:assert/strict");
const { randomInt, randomUUID } = require("node:crypto");
const { once } = require("node:events");

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);

  const db = require("../lib/prisma");
  const chat = require("../api/services/ChatService");
  const bridge = require("../api/services/TelegramBridgeService");
  const express = require("express");
  const jwt = require("jsonwebtoken");
  const telegramUserId = randomInt(100000, 2 ** 32);
  const replies = [];
  bridge.sendTelegramMessage = async reply => { replies.push(reply); };
  process.env.TELEGRAM_WEBHOOK_SECRET = randomUUID();
  process.env.JWT_SECRET = randomUUID();
  const aiCalls = [];
  chat.ai.ask = async options => {
    aiCalls.push(options);
    return "Odpowiedź z lokalnego mocka";
  };
  chat.ai.extractMemories = async () => [];

  const app = express();
  app.use(express.json());
  app.use("/api/telegram", require("../api/routes/telegramRoutes"));
  app.use("/api/chat", require("../api/routes/chatRoutes"));
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const endpoint = `http://127.0.0.1:${server.address().port}/api/telegram/webhook`;
    const user = await db.user.create({ data: {
      email: randomUUID() + "@example.test", password: "unused",
      agents: { create: { key: "investment", name: "Investment", type: "INVESTMENT" } }
    } });
    const [alpha, beta] = await Promise.all(["alpha", "beta"].map(slug => db.organization.create({
      data: {
        name: slug, slug: slug + "-" + randomUUID(),
        memberships: { create: { userId: user.id, role: "OWNER" } },
        investments: { create: { name: slug + " investment", createdById: user.id } }
      }
    })));

    async function update(messageId, text, secret = process.env.TELEGRAM_WEBHOOK_SECRET) {
      const id = telegramUserId;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
        body: JSON.stringify({ update_id: messageId,
          message: { message_id: messageId, text, chat: { id, type: "private" }, from: { id } } })
      });
      return response.status;
    }

    const link = await bridge.createLink({ userId: user.id });
    assert.equal(await update(1, "/start " + link.code, "incorrect"), 403);
    assert.equal(replies.length, 0);
    assert.equal(await update(1, "/start " + link.code), 200);
    assert.match(replies.at(-1).text, /Polaczono/);
    assert.equal(await update(2, "/status"), 200);
    assert.match(replies.at(-1).text, /zadania/);
    assert.equal(await update(3, "Dzień dobry"), 200);
    assert.equal(replies.at(-1).text, "Odpowiedź z lokalnego mocka");

    assert.equal(await update(4, "/spolka " + alpha.slug), 200);
    const text = "Przeanalizuj inwestycje";
    const previous = replies.length;
    assert.deepEqual(await Promise.all([update(5, text), update(5, text)]), [200, 200]);
    assert.equal(replies.length, previous + 1);
    assert.match(replies.at(-1).text, /Odpowiedź z lokalnego mocka/);
    const alphaPrompt = aiCalls.at(-1).user;
    assert.match(alphaPrompt, /alpha investment/);
    assert.doesNotMatch(alphaPrompt, /beta investment/);

    const auth = { Authorization: "Bearer " + jwt.sign({ id: user.id }, process.env.JWT_SECRET) };
    const webUrl = "http://127.0.0.1:" + server.address().port + "/api/chat";
    const webResponse = await fetch(webUrl, {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ message: text, organizationId: alpha.id, requestId: "telegram-" + telegramUserId + "-5" })
    });
    assert.equal(webResponse.status, 200);
    const web = await webResponse.json();
    assert.match(web.answer, /Odpowiedź z lokalnego mocka/);
    assert.equal(await update(6, "/spolka " + beta.slug), 200);
    assert.equal(await update(7, "Pokaż wyniki"), 200);
    assert.match(replies.at(-1).text, /nie ma zleceń/);
    assert.equal(await update(8, "/spolka " + alpha.slug), 200);
    assert.equal(await update(9, "Pokaż wyniki"), 200);
    assert.match(replies.at(-1).text, /Odpowiedź z lokalnego mocka/);
    assert.equal(aiCalls.length, 3);

    const telegram = await db.chatConversation.findMany({
      where: { userId: user.id, channel: "TELEGRAM" }, include: { messages: true }
    });
    assert.equal(telegram.length, 3);
    const company = telegram.find(row => row.messages.some(message => message.content === text));
    assert.equal(company.messages.length, 4);
    assert.equal((await fetch(webUrl + "/" + company.id, { headers: auth })).status, 404);
    const listed = await fetch(webUrl, { headers: auth });
    assert.equal(listed.status, 200);
    assert.deepEqual((await listed.json()).conversations.map(row => row.id), [web.conversationId]);
    await db.organizationMembership.updateMany({
      where: { userId: user.id, organizationId: alpha.id }, data: { status: "REVOKED" }
    });
    assert.equal(await update(10, "Pokaż wyniki"), 200);
    assert.match(replies.at(-1).text, /Brak dostępu/);
    assert.equal(aiCalls.length, 3);
    console.log("Telegram PostgreSQL E2E passed");
  } finally {
    server.close();
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
