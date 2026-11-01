"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/lib/chatDashboardPayload.js"), "utf8"
    );
    return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

const item = { id: "chat-1", title: "Nowa rozmowa", _count: { messages: 2 } };
const message = { id: "msg-1", role: "assistant", content: "Odpowiedź" };

test("chat list distinguishes verified empty list from invalid responses", async () => {
    const { parseChatListResponse } = await loadParser();
    assert.deepEqual(parseChatListResponse({ success: true, conversations: [] }), []);
    assert.deepEqual(parseChatListResponse({ success: true, conversations: [item] }), [item]);
    for (const response of [null, {}, { conversations: [] }, { success: false, conversations: [] },
        { success: "true", conversations: [] }, { success: true, conversations: null },
        { success: true, conversations: [null] },
        { success: true, conversations: [{ ...item, title: "" }] }]) {
        assert.throws(() => parseChatListResponse(response), /Nieprawidłowa odpowiedź listy rozmów/);
    }
});

test("chat details require the requested conversation and valid messages", async () => {
    const { parseChatDetailResponse } = await loadParser();
    const conversation = { id: "chat-1", messages: [message] };
    assert.deepEqual(parseChatDetailResponse({ success: true, conversation }, "chat-1"), conversation);
    assert.deepEqual(parseChatDetailResponse({ success: true, conversation: { id: "chat-1", messages: [] } }, "chat-1").messages, []);
    for (const response of [null, {}, { success: false, conversation },
        { success: true, conversation: null }, { success: true, conversation: { id: "chat-2", messages: [] } },
        { success: true, conversation: { id: "chat-1" } },
        { success: true, conversation: { id: "chat-1", messages: [null] } },
        { success: true, conversation: { id: "chat-1", messages: [{ ...message, content: null }] } }]) {
        assert.throws(() => parseChatDetailResponse(response, "chat-1"), /Nieprawidłowa odpowiedź zapisanej rozmowy/);
    }
});

test("chat send requires an acknowledged saved assistant response", async () => {
    const { parseChatSendResponse } = await loadParser();
    const response = { success: true, conversationId: "chat-1", answer: "Odpowiedź", message };
    assert.deepEqual(parseChatSendResponse(response), response);
    for (const bad of [null, {}, { ...response, success: false },
        { ...response, conversationId: "" }, { ...response, answer: "" },
        { ...response, message: null }, { ...response, message: { ...message, role: "user" } },
        { ...response, message: { ...message, content: "Inna" } }]) {
        assert.throws(() => parseChatSendResponse(bad), /Brak potwierdzenia odpowiedzi asystenta/);
    }
});

test("chat archive requires an explicit success acknowledgement", async () => {
    const { parseChatArchiveResponse } = await loadParser();
    assert.equal(parseChatArchiveResponse({ success: true }), true);
    for (const response of [null, {}, { success: false }, { success: "true" }]) {
        assert.throws(() => parseChatArchiveResponse(response), /Brak potwierdzenia archiwizacji rozmowy/);
    }
});

test("chat UI validates all responses and does not mistake load errors for empty history", async () => {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/app/chat/page.js"), "utf8"
    );
    assert.match(source, /setConversations\(parseChatListResponse\(data\)\)/);
    assert.match(source, /parseChatDetailResponse\(data, id\)/);
    assert.match(source, /parseChatSendResponse\(response\)/);
    assert.match(source, /parseChatArchiveResponse\(response\)/);
    assert.match(source, /!conversationsError &&/);
    assert.match(source, /Nie udało się pobrać rozmów/);
});
