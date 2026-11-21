"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const routeSource = fs.readFileSync(path.join(__dirname, "../api/routes/chatRoutes.js"), "utf8");
const serviceSource = fs.readFileSync(path.join(__dirname, "../api/services/VoiceTranscriptionService.js"), "utf8");
const chatUi = fs.readFileSync(path.join(__dirname, "../frontend/src/app/chat/page.js"), "utf8");

function routeHarness() {
  const routes = { get: {}, post: {}, delete: {} };
  const calls = [];
  const verifyToken = () => {};
  const router = {
    get(path, ...handlers) { routes.get[path] = handlers; },
    post(path, ...handlers) { routes.post[path] = handlers; },
    delete(path, ...handlers) { routes.delete[path] = handlers; }
  };
  class VoiceTranscriptionService {
    async transcribe(payload) { calls.push(payload); return "Sprawdzić dokumenty"; }
  }
  const multer = () => ({ single: () => (_req, _res, next) => next(null) });
  multer.memoryStorage = () => ({});
  const dependencies = {
    "express": { Router: () => router },
    "../middleware/verifyToken": verifyToken,
    "../controllers/ChatController": class ChatController {},
    "multer": multer,
    "../services/VoiceTranscriptionService": { VoiceTranscriptionService }
  };
  const context = { module: { exports: {} }, require(name) {
    if (name === "node:path") return path;
    assert.ok(Object.hasOwn(dependencies, name), "unexpected dependency: " + name);
    return dependencies[name];
  }, Buffer };
  vm.runInNewContext(routeSource, context, { filename: "chatRoutes.js" });
  return { routes, calls, verifyToken };
}
const response = () => ({
  code: 200,
  headers: {},
  status(code) { this.code = code; return this; },
  set(name, value) { this.headers[name] = value; return this; },
  json(payload) { this.body = payload; return this; }
});

test("voice endpoint enforces JWT before multipart and reuses existing chat endpoint", () => {
  const h = routeHarness();
  assert.equal(h.routes.post["/transcribe"][0], h.verifyToken);
  assert.ok(h.routes.post["/"]);
  assert.ok(h.routes.get["/:id"]);
});

test("short valid WebM capture is transcribed without storing audio", async () => {
  const h = routeHarness();
  const req = { user: { id: "u" }, file: {
    originalname: "voice.webm", mimetype: "audio/webm",
    buffer: Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(50)]),
    size: 54
  } };
  const res = response();
  await h.routes.post["/transcribe"][1](req, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.transcript, "Sprawdzić dokumenty");
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].filename, "voice.webm");
  assert.equal(res.headers["Cache-Control"], "private, no-store");
});

test("fake WebM is rejected before transcription", async () => {
  const h = routeHarness();
  const req = { user: { id: "u" }, file: {
    originalname: "voice.webm", mimetype: "audio/webm",
    buffer: Buffer.alloc(50), size: 50
  } };
  const res = response();
  await h.routes.post["/transcribe"][1](req, res);
  assert.equal(res.code, 400);
  assert.equal(h.calls.length, 0);
});

test("audio to transcription endpoint never includes account identifiers in outbound file", async () => {
  const calls = [];
  const OpenAI = class {};
  const dependencies = {
    "openai": OpenAI,
    "openai/uploads": { toFile: async (buffer, name, options) => {
      calls.push({ name, options, bytes: buffer.length });
      return { file: true };
    } }
  };
  const context = { module: { exports: {} }, process: { env: { OPENAI_API_KEY: "test-key" } },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), "unexpected require: " + name);
      return dependencies[name];
    } };
  vm.runInNewContext(serviceSource, context, { filename: "VoiceTranscriptionService.js" });
  const client = { audio: { transcriptions: { create: async options => {
    calls.push(options);
    return { text: "  Jadę do Mielna  " };
  } } } };
  const service = new context.module.exports.VoiceTranscriptionService({ createClient: () => client });
  const transcript = await service.transcribe({ buffer: Buffer.alloc(50), filename: "voice.webm", contentType: "audio/webm" });
  assert.equal(transcript, "Jadę do Mielna");
  assert.equal(calls[1].model, "gpt-4o-mini-transcribe");
  assert.equal(calls[1].language, "pl");
  assert.equal(calls[0].name, "voice.webm");
});

test("voice UI provides MediaRecorder fallback, length limit and cancellation", () => {
  assert.match(chatUi, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(chatUi, /async function startRecorder\(\)/);
  assert.match(chatUi, /MediaRecorder/);
  assert.match(chatUi, /transcribeVoice\(formData\)/);
  assert.match(chatUi, /turn\.cancelled=true/);
  assert.match(chatUi, /transcribingRef\.current/);
  assert.match(chatUi, /},30000\)/);
  assert.match(chatUi, /if\(shouldSubmitVoiceTurn\(turn\)\)send\(finalText\)/);
});
