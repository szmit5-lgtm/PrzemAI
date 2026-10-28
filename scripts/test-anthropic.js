"use strict";

/**
 * Manual, opt-in Anthropic smoke test for staging only.
 * Usage: ANTHROPIC_API_KEY=... node scripts/test-anthropic.js
 * No database, email, GitHub or production actions.
 */
const https = require("node:https");

async function main() {
  if (process.env.CLAUDE_DEV_ENABLED !== "true") {
    throw new Error("Set CLAUDE_DEV_ENABLED=true explicitly to permit a paid API test.");
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const model = process.env.CLAUDE_DEV_MODEL || "claude-haiku-4-5";
  const payload = JSON.stringify({
    model,
    max_tokens: 64,
    messages: [{ role: "user", content: "Reply with exactly: PRZEMAI_CLAUDE_OK" }]
  });
  const data = await new Promise((resolve, reject) => {
    const req = https.request("https://api.anthropic.com/v1/messages", {
      method: "POST",
      timeout: 15000,
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload)
      }
    }, res => {
      let body = "";
      res.on("data", chunk => {
        body += chunk;
        if (body.length > 16384) req.destroy(new Error("Response too large"));
      });
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { return reject(new Error("Invalid API response")); }
        if (res.statusCode !== 200) {
          return reject(new Error("Anthropic HTTP " + res.statusCode + ": " + (parsed.error?.type || "unknown")));
        }
        resolve(parsed);
      });
    });
    req.on("timeout", () => req.destroy(new Error("Anthropic request timed out")));
    req.on("error", reject);
    req.end(payload);
  });
  const answer = data.content?.filter(part => part.type === "text").map(part => part.text).join("").trim();
  if (answer !== "PRZEMAI_CLAUDE_OK") throw new Error("Unexpected test response");
  console.log(JSON.stringify({
    ok: true, model: data.model, inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens
  }));
}

if (require.main === module) {
  main().catch(error => {
    console.error("[Claude smoke test]", error.message);
    process.exitCode = 1;
  });
}
module.exports = { main };
