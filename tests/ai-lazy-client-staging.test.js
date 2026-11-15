"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("API can construct AIEngine without provider credentials; requests fail closed", () => {
  const code = [
    'delete process.env.OPENAI_API_KEY;',
    'const AIEngine = require("./core/ai/AIEngine");',
    'const engine = new AIEngine();',
    'if (engine.client !== null) process.exit(2);',
    'engine.ask({ user: "No paid call" }).then(() => { process.exitCode = 3; },',
    '  err => { if (!/not configured/.test(err.message)) process.exitCode = 4; });'
  ].join("\n");
  const result = spawnSync(process.execPath, ["-e", code], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, OPENAI_API_KEY: "" },
    encoding: "utf8",
    timeout: 5000
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Missing credentials/);
});
