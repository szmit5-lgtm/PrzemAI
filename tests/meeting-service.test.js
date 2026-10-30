"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../api/services/MeetingService.js"), "utf8");

function meetingService({ transcript, transcriptionError, aiResponse, aiError } = {}) {
  const calls = { transcribed: [], ai: [] };
  class SpeechToText {
    async transcribe(filePath) {
      calls.transcribed.push(filePath);
      if (transcriptionError) throw transcriptionError;
      return transcript;
    }
  }
  class AIEngine {
    async ask(options) {
      calls.ai.push(options);
      if (aiError) throw aiError;
      return aiResponse;
    }
  }
  const dependencies = {
    "../../core/speech/SpeechToText": SpeechToText,
    "../../core/ai/AIEngine": AIEngine
  };
  const context = {
    module: { exports: {} },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `unexpected dependency: ${name}`);
      return dependencies[name];
    }
  };
  vm.runInNewContext(source, context, { filename: "MeetingService.js" });
  return { service: context.module.exports, calls };
}

test("meeting analysis rejects empty transcription without calling AI", async () => {
  for (const transcript of ["", " \n\t ", null]) {
    const { service, calls } = meetingService({ transcript });
    await assert.rejects(service.analyze("empty.mp3"), /Nie udało się utworzyć transkrypcji spotkania/);
    assert.deepEqual(calls.transcribed, ["empty.mp3"]);
    assert.equal(calls.ai.length, 0);
  }
});

test("meeting analysis requests JSON, includes the entire transcript and forbids invented owners or dates", async () => {
  const transcript = "Anna: proszę wysłać ofertę w piątek. Piotr: sprawdzę kosztorys.";
  const report = { summary: "Ustalenia", participants: ["Anna", "Piotr"], actionItems: [] };
  const { service, calls } = meetingService({ transcript, aiResponse: report });
  assert.equal(await service.analyze("meeting.wav"), report);
  assert.deepEqual(calls.transcribed, ["meeting.wav"]);
  assert.equal(calls.ai.length, 1);
  assert.equal(calls.ai[0].json, true);
  assert.match(calls.ai[0].system, /JSON/);
  assert.ok(calls.ai[0].user.includes(transcript), "the original transcript must reach the AI");
  assert.match(calls.ai[0].user, /actionItems/);
  assert.match(calls.ai[0].user, /nie wymyślaj osób, terminów ani ustaleń/);
});

test("transcription errors propagate without invoking AI", async () => {
  const error = new Error("Transcription unavailable");
  const { service, calls } = meetingService({ transcriptionError: error });
  await assert.rejects(service.analyze("broken.mp3"), err => err === error);
  assert.equal(calls.ai.length, 0);
});

test("AI errors propagate after a successful transcription", async () => {
  const error = new Error("AI unavailable");
  const { service, calls } = meetingService({ transcript: "Spotkanie rozpoczęte.", aiError: error });
  await assert.rejects(service.analyze("meeting.mp3"), err => err === error);
  assert.deepEqual(calls.transcribed, ["meeting.mp3"]);
  assert.equal(calls.ai.length, 1);
});
