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
      findFirst: async ({ where }) => where.id === "shared" && where.userId === "linked" &&
        where.channel === "WEB" ? { messages: [{ metadata: { organizationId: "a" } }] } : null,
      createMany: async ({ data, skipDuplicates }) => {
        assert.equal(skipDuplicates, true);
        if (!conversations.has(data.id)) conversations.set(data.id, data);
      }
    }
  };
  let nextId = 1;
  function send(text, { messageId = nextId++, sender = 42, chatId = sender,
    type = "private", updateId = messageId, chat, caption, document, voice, photo, extractDocument, extractPhoto, transcribe } = {}) {
    return handleCommand({
      db,
      update: { update_id: updateId, message: {
        message_id: messageId, text, caption, document, voice, photo, from: { id: sender }, chat: { id: chatId, type }
      } },
      extractDocument, extractPhoto, transcribe,
      chat: async (userId, message, id, options) => {
        calls.push({ userId, message, id, ...options });
        if (!options.sharedWebThread)
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
    userId: "linked", message: "Jak się masz?", organizationId: null, channel: "TELEGRAM",
    requestId: "telegram-42-5"
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
  global.prisma.organizationMembership = { findFirst: async ({ where }) => ({
    userId: where.userId, organizationId: where.organizationId, role: "MEMBER"
  }) };
  global.prisma.userSettings = { upsert: async () => ({ historyEnabled: true }) };
  global.prisma.chatMessage = {
    createMany: async ({ data }) => { messages.push(data); },
    findUnique: async ({ where }) => messages.find(message => message.id === where.id) ?? null
  };
  t.after(() => {
    delete global.prisma.chatConversation.update;
    delete global.prisma.userSettings;
    delete global.prisma.organizationMembership;
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

test("linked Telegram continues the exact WEB thread only in its verified company scope", async () => {
  const { send, calls } = fixture();
  assert.match((await send("/watek shared Kontynuuj")).text, /Nie znaleziono/);
  await send("/spolka alpha");
  assert.match((await send("/watek foreign Kontynuuj")).text, /Nie znaleziono/);
  assert.equal((await send("/watek shared Kontynuuj")).text, "Odpowiedź wspólnego czatu");
  assert.deepEqual(calls.map(({ userId, message, id, organizationId, sharedWebThread }) =>
    ({ userId, message, id, organizationId, sharedWebThread })), [{
    userId: "linked", message: "Kontynuuj", id: "shared", organizationId: "a", sharedWebThread: true
  }]);
});


test("linked documents reuse the selected chat and a provider replay never extracts again", async () => {
  const { send, calls } = fixture();
  await send("/spolka alpha");
  await send("Przygotuj analizę");
  const document = { file_id: "test", file_name: "protokol.pdf", file_size: 150 };
  let extracted = 0;
  const options = { messageId: 700, document, caption: "Zestaw protokół", extractDocument: async media => {
    assert.equal(media, document);
    extracted++;
    return { name: "protokol.pdf", text: "Treść syntetyczna." };
  } };
  const replies = await Promise.all([send(undefined, options), send(undefined, options)]);
  assert.equal(replies.filter(Boolean).length, 1);
  assert.equal(extracted, 1);
  assert.equal(calls[1].id, calls[0].id);
  assert.equal(calls[1].organizationId, "a");
  assert.equal(calls[1].message, "Zestaw protokół");
  assert.deepEqual(calls[1].attachment, { name: "protokol.pdf", text: "Treść syntetyczna." });
});

test("company changes while media is processing suppress a stale document or voice turn", async () => {
  const { send, calls } = fixture();
  await send("/spolka alpha");
  assert.equal(await send(undefined, { document: { file_id: "a" }, extractDocument: async () => {
    await send("/spolka beta");
    return { name: "test.pdf", text: "Treść" };
  } }), null);
  assert.equal(await send(undefined, { voice: { file_id: "a" }, transcribe: async () => {
    await send("/spolka alpha");
    return "Głos";
  } }), null);
  assert.equal(calls.length, 0);
});

test("Telegram document downloader bounds bytes and rejects paths outside the document directory", async () => {
  const { extractTelegramDocument } = require("../api/services/TelegramMediaService");
  const bytes = Buffer.from("%PDF-synthetic");
  const document = { file_id: "test_id", file_name: "synthetic.pdf", file_size: bytes.length };
  const extractor = async ({ buffer, originalname }) => {
    assert.deepEqual(buffer, bytes);
    assert.equal(originalname, "synthetic.pdf");
    return { name: originalname, text: "synthetic" };
  };
  const getFile = filePath => Response.json({ result: { file_path: filePath } });
  let fetchCount = 0;
  assert.deepEqual(await extractTelegramDocument(document, { extractor, token: "synthetic",
    fetchRequest: async (_url, { redirect }) => {
      assert.equal(redirect, "error");
      return ++fetchCount === 1 ? getFile("documents/file_2.pdf") : new Response(bytes);
    }
  }), { name: "synthetic.pdf", text: "synthetic" });
  for (const invalidPath of ["documents/../private.pdf", "https://elsewhere.test/file.pdf"]) {
    fetchCount = 0;
    await assert.rejects(extractTelegramDocument(document, { extractor, token: "synthetic",
      fetchRequest: () => { fetchCount++; return getFile(invalidPath); }
    }), /Unsupported Telegram file path/);
    assert.equal(fetchCount, 1);
  }
  fetchCount = 0;
  await assert.rejects(extractTelegramDocument(document, { extractor, token: "synthetic",
    fetchRequest: () => ++fetchCount === 1 ? getFile("documents/file_2.pdf") :
      new Response(Buffer.concat([bytes, bytes]))
  }), /too large/);
});


test("a linked Telegram photo uses its caption and selected company and rejects duplicate extraction", async () => {
  const { send, calls } = fixture();
  await send("/spolka alpha");
  const photo = [{ file_id: "image", width: 200, height: 100, file_size: 200 }];
  let extracted = 0;
  const options = { messageId: 901, photo, caption: "Odczytaj zdjęcie", extractPhoto: async variants => {
    assert.deepEqual(variants, photo);
    extracted++;
    return { name: "zdjecie-telegram.jpg", text: "Przykładowy protokół" };
  } };
  assert.equal(await send(undefined, { ...options, type: "group" }), null);
  assert.match((await send(undefined, { ...options, sender: 43 })).text, /Najpierw/);
  assert.equal((await send(undefined, options)).text, "Odpowiedź wspólnego czatu");
  assert.equal(await send(undefined, options), null);
  assert.equal(extracted, 1);
  assert.equal(calls[0].organizationId, "a");
  assert.equal(calls[0].message, "Odczytaj zdjęcie");
  assert.match(calls[0].attachment.text, /protokół/);
});

test("Telegram photo download chooses a bounded variant and accepts only a photos path", async () => {
  const { extractTelegramPhoto } = require("../api/services/TelegramMediaService");
  const sizes = [
    { file_id: "thumb", width: 30, height: 30, file_size: 20 },
    { file_id: "selected", width: 600, height: 400, file_size: 30 },
    { file_id: "too-large", width: 2000, height: 1000, file_size: 5000000 }
  ];
  const urls = [];
  const options = { token: "synthetic", fetchRequest: async url => {
    urls.push(url);
    return urls.length === 1 ? Response.json({ result: { file_path: "photos/file_42.jpg" } }) : new Response(Buffer.alloc(30));
  }, extractor: async ({ buffer, originalname }) => ({ bytes: buffer.length, originalname }) };
  assert.deepEqual(await extractTelegramPhoto(sizes, options), { bytes: 30, originalname: "zdjecie-telegram.jpg" });
  assert.match(urls[0], /file_id=selected$/);
  await assert.rejects(extractTelegramPhoto(sizes, { ...options, fetchRequest: async () =>
    Response.json({ result: { file_path: "documents/file_42.jpg" } }) }), /Unsupported Telegram file path/);
});
