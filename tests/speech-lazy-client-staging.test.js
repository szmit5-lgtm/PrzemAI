"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("speech module can initialize without an AI key while transcription fails closed", () => {
  const command = [
    'delete process.env.OPENAI_API_KEY;',
    'const SpeechToText = require("./core/speech/SpeechToText");',
    'const service = new SpeechToText();',
    'if (service.client !== null) process.exit(2);',
    'service.transcribeSingleFile("/unused/never-opened.mp3")',
    '  .then(() => { process.exitCode = 3; },',
    '    error => { if (!/not configured/.test(error.message)) process.exitCode = 4; });'
  ].join("\n");
  const result = spawnSync(process.execPath, ["-e", command], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, OPENAI_API_KEY: "" },
    encoding: "utf8",
    timeout: 10000
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Missing credentials/);
});
