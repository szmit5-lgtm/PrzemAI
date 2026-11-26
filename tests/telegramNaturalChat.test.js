"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const webQueries = [];
global.prisma = {
  chatConversation: {
    findMany: async ({ where }) => { webQueries.push(where); return []; },
    findFirst: async ({ where }) => { webQueries.push(where); return null; }
  }
};
const { handleCommand, sendTelegramMessage } = require("../api/services/TelegramBridgeService");
const ChatService = require("../api/services/ChatService");

function fixture() {
  const companies = [
    { id: "a", slug: "alpha", name: "Alpha", status: "ACTIVE" },
    { id: "b", slug: "beta", name: "Beta", status: "ACTIVE" },
    { id: "c", slug: "hidden", name: "Hidden", status: "ACTIVE" }
  ];
  const members = companies.slice(0, 2).map(organization => ({
    organization, organizationId: organization.id, userId: "linked", role: "MEMBER", status: "ACTIVE"
  }));
  const selection = new Map();
  const conversations = new Map();
  const receipts = new Set();
  const calls = [];
  const bindings = new Map([["42", "linked"]]);
  const selectionKey = ({ userId_telegramUserId }) => JSON.stringify(userId_telegramUserId);
  const active = (member, where) => member.userId === where.userId &&
    member.status === where.status && member.organization.status === where.organization.status;
  const db = {
    history: { findFirst: async ({ where }) => {
      const userId = bindings.get(where.report.equals);
      return userId ? { userId, report: { status: "LINKED" } } : null;
    } },
    organization: { findUnique: async ({ where }) => companies.find(company => company.slug === where.slug) },
    organizationMembership: {
      findMany: async ({ where }) => members.filter(member => active(member, where)),
      findFirst: async ({ where }) => members.find(member => active(member, where) &&
        member.organizationId === where.organizationId && where.role.in.includes(member.role))
    },
    telegramChatSelection: {
      findUnique: async ({ where }) => selection.get(selectionKey(where)),
      upsert: async ({ where, create }) => selection.set(selectionKey(where), create)
    },
    telegramChatReceipt: {
      create: async ({ data }) => {
        const key = JSON.stringify([data.telegramUserId, data.messageId]);
        if (receipts.has(key)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
        receipts.add(key);
      }
    },
    chatConversation: {
      createMany: async ({ data, skipDuplicates }) => {
        assert.equal(skipDuplicates, true);
        if (!conversations.has(data.id)) conversations.set(data.id, data);
      }
    }
  };
  let nextId = 1;
  function send(text, { messageId = nextId++, sender = 42, chatId = sender,
    type = "private", updateId = messageId, chat } = {}) {
    return handleCommand({
      db,
      update: { update_id: updateId, message: {
        message_id: messageId, text, from: { id: sender }, chat: { id: chatId, type }
      } },
      chat: async (userId, message, id, options) => {
        calls.push({ userId, message, id, ...options });
        assert.deepEqual(conversations.get(id), { id, userId, channel: "TELEGRAM", title: "Telegram" });
        return chat ? chat(userId, message, id, options) : { answer: "Odpowiedź wspólnego czatu" };
      }
    });
  }
  return { send, members, bindings, calls, receipts };
}

test("natural text reaches shared chat only from the linked private Telegram identity", async () => {
  const { send, calls, receipts } = fixture();
  assert.equal(await send("Pytanie", { type: "group" }), null);
  assert.equal(await send("Pytanie", { chatId: 43 }), null);
  assert.match((await send("Pytanie", { sender: 43 })).text, /Najpierw/);
  assert.equal(receipts.size, 0);
  assert.equal(calls.length, 0);
  assert.match((await send("/unknown")).text, /Komendy/);
  assert.match((await send("Pytanie", { messageId: 0 })).text, /identyfikatora/);
  assert.deepEqual(await send(" Jak się masz? "), { chatId: 42, text: "Odpowiedź wspólnego czatu" });
  assert.deepEqual(calls.map(({ id, ...turn }) => turn), [{
    userId: "linked", message: "Jak się masz?", organizationId: null, channel: "TELEGRAM"
  }]);
});

test("company choices authorize membership and keep stable, separate conversation IDs", async () => {
  const { send, calls } = fixture();
  const companyList = (await send("/spolka")).text;
  assert.match(companyList, /alpha/);
  assert.match(companyList, /beta/);
  assert.doesNotMatch(companyList, /hidden/);
  await send("Cześć");
  await send("/spolka alpha");
  await send("Sprawdź faktury");
  assert.match((await send("/spolka hidden")).text, /Brak dostępu/);
  await send("Pokaż wyniki");
  await send("/spolka beta");
  await send("Pokaż wyniki");
  await send("/spolka alpha");
  await send("Kontynuuj");
  await send("/spolka -");
  await send("Wracam");
  assert.deepEqual(calls.map(call => call.organizationId), [null, "a", "a", "b", "a", null]);
  assert.equal(new Set(calls.map(call => call.id)).size, 3);
  assert.equal(calls[1].id, calls[4].id);
  assert.equal(calls[0].id, calls[5].id);
});

test("revoked company access blocks chat without falling back to a personal conversation", async () => {
  const { send, calls, members } = fixture();
  await send("/spolka alpha");
  members[0].status = "REVOKED";
  assert.match((await send("Pokaż faktury")).text, /Brak dostępu/);
  assert.equal(calls.length, 0);
});

test("a reply is suppressed after unlinking or revoking company membership during chat", async () => {
  const { send, members, bindings } = fixture();
  await send("/spolka alpha");
  const denied = await send("Pokaż faktury", { chat: () => {
    members[0].status = "REVOKED";
    return { answer: "Tajne dane spółki" };
  } });
  assert.match(denied.text, /Brak dostępu/);
  assert.doesNotMatch(denied.text, /Tajne/);
  await send("/spolka -");
  assert.equal(await send("Pokaż historię", { chat: () => {
    bindings.set("42", "other");
    return { answer: "Dane pierwotnego użytkownika" };
  } }), null);
});

test("concurrent and rewrapped Telegram deliveries process a message only once", async () => {
  const { send, calls } = fixture();
  const first = await Promise.all(Array.from({ length: 5 }, (_, index) =>
    send("Pojedyncze pytanie", { messageId: 77, updateId: 100 + index })));
  assert.equal(first.filter(Boolean).length, 1);
  assert.equal(calls.length, 1);
  assert.equal(await send("Pojedyncze pytanie", { messageId: 77 }), null);
});

test("web reads and writes cannot reopen Telegram conversations", async () => {
  await ChatService.listConversations("linked");
  await ChatService.getConversation("linked", "telegram-id");
  await assert.rejects(ChatService.archiveConversation("linked", "telegram-id"), /nie istnieje/);
  await assert.rejects(ChatService.getOrCreateConversation("linked", "telegram-id", "test"), /nie istnieje/);
  assert.equal(webQueries.length, 4);
  assert.ok(webQueries.every(where => where.channel === "WEB" && where.userId === "linked"));
});

test("long replies use mocked Telegram sends and preserve emoji boundaries", async () => {
  const text = "a".repeat(3899) + "😀" + "b".repeat(3900);
  const chunks = [];
  await sendTelegramMessage({ chatId: 42, text, token: "mock", fetchFn: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, 42);
    assert.ok(body.text.length <= 3900);
    assert.doesNotMatch(body.text, /[\uD800-\uDBFF]$/);
    chunks.push(body.text);
    return { ok: true };
  } });
  assert.equal(chunks.join(""), text);
});

test("shared ChatService saves a company turn and keeps specialist results behind their plan", async t => {
  const messages = [];
  const plans = [];
  const { send } = fixture();
  t.mock.method(global.prisma.chatConversation, "findFirst", async ({ where }) => {
    assert.equal(where.channel, "TELEGRAM");
    assert.equal(where.userId, "linked");
    return { id: where.id };
  });
  global.prisma.chatConversation.update = async () => {};
  global.prisma.userSettings = { upsert: async () => ({ historyEnabled: true }) };
  global.prisma.chatMessage = { create: async ({ data }) => {
    const message = { ...data, id: String(messages.length + 1) };
    messages.push(message);
    return message;
  } };
  t.after(() => {
    delete global.prisma.chatConversation.update;
    delete global.prisma.userSettings;
    delete global.prisma.chatMessage;
  });

  t.mock.method(ChatService.general, "handleTurn", async scope => {
    plans.push(scope);
    return { planId: scope.turnId, answer: "Wynik specjalisty z mocka" };
  });
  await send("/spolka alpha");
  const reply = await send("Sprawdź faktury", {
    chat: (...args) => ChatService.chat(...args)
  });
  assert.equal(reply.text, "Wynik specjalisty z mocka");
  assert.equal(plans[0].organizationId, "a");
  assert.equal(plans[0].conversationId, messages[0].conversationId);
  assert.equal(plans[0].turnId, messages[0].id);
  assert.deepEqual(messages.map(({ role, metadata }) => [role, metadata.organizationId]),
    [["user", "a"], ["assistant", "a"]]);
  assert.equal(messages[1].metadata.generalPlanId, messages[0].id);
  assert.doesNotMatch(messages[1].content, /Wynik specjalisty z mocka/);
});
