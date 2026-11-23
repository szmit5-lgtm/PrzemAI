const test = require("node:test");
const assert = require("node:assert/strict");
const AIEngine = require("../core/ai/AIEngine");

test("non-AI startup does not require OPENAI_API_KEY", () => {
  const original = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    const engine = new AIEngine();
    assert.equal(engine._client, null);
    assert.throws(() => engine.client, /OPENAI_API_KEY is required/);
    assert.equal(engine._client, null);
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});
