"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const service = {
  calls: [],
  async chat(userId, message, conversationId) {
    this.calls.push({ userId, message, conversationId });
    return { conversationId: "conversation-1", answer: "OK", message: { id: "message-1" } };
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/api/controllers/ChatController.js") &&
      request === "../services/ChatService") return service;
  return originalLoad.call(this, request, parent, isMain);
};
let ChatController;
try {
  ChatController = require("../api/controllers/ChatController");
} finally {
  Module._load = originalLoad;
}

function response() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}
const controller = new ChatController();

test("chat rejects non-string and empty messages without calling AI", async () => {
  service.calls = [];
  for (const message of [null, "", "  ", { text: "hello" }, 123]) {
    const res = response();
    await controller.chat({ user: { id: "u1" }, body: { message } }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(service.calls.length, 0);
});

test("chat rejects overlong messages before invoking AI", async () => {
  service.calls = [];
  const res = response();
  await controller.chat({ user: { id: "u1" }, body: { message: "a".repeat(12001) } }, res);
  assert.equal(res.statusCode, 413);
  assert.equal(service.calls.length, 0);
});

test("chat rejects invalid conversation IDs", async () => {
  service.calls = [];
  const res = response();
  await controller.chat({ user: { id: "u1" }, body: { message: "test", conversationId: { id: "x" } } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(service.calls.length, 0);
});

test("chat uses authenticated user ID and valid conversation ID", async () => {
  service.calls = [];
  const res = response();
  await controller.chat({ user: { id: "u1" }, body: { message: "Czy są faktury?", conversationId: "c1" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.answer, "OK");
  assert.deepEqual(service.calls, [{ userId: "u1", message: "Czy są faktury?", conversationId: "c1" }]);
});
