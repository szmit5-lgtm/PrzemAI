"use strict";
const assert = require("node:assert/strict");
const { reserveClaude } = require("../lib/claudeRequestPolicy");
const { openAIRequestPolicy } = require("../lib/openAIRequestPolicy");

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);
  const db = require("../lib/prisma");
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const today = new Date().toISOString().slice(0, 10);
  const ledger = () => db.$queryRaw`SELECT "reservedMicroPln", "claudeReservedMicroPln"
    FROM "OpenAIMonthlyBudget" WHERE "month" = ${month}::date`;
  let fixtureCreated = false;
  try {
    assert.deepEqual(await ledger(), []);
    const daily = () => db.$queryRaw`SELECT "requests" FROM "OpenAIRequestBudget" WHERE "day" = ${today}::date`;
    assert.deepEqual(await daily(), []);
    await db.$executeRaw`INSERT INTO "OpenAIMonthlyBudget" ("month", "reservedMicroPln") VALUES (${month}::date, 170000000)`;
    fixtureCreated = true;
    const races = await Promise.allSettled([1, 2].map(() => reserveClaude(20000000n, 50000000n, db)));
    assert.equal(races.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(races.find(result => result.status === "rejected").reason.code, "AI_MONTHLY_BUDGET_LIMIT");
    let calls = 0;
    const openAI = (input, output) => openAIRequestPolicy({
      db, fetchRequest: async () => { calls++; return new Response(); },
      priceBounds: JSON.stringify({ "gpt-5.5": { input, output, validUntil: "2099-01-01" } })
    });
    const endpoint = "https://api.openai.com/v1/responses";
    const request = { method: "POST", body: JSON.stringify({
      model: "gpt-5.5", max_output_tokens: 4096,
      input: [{ role: "user", content: [{ type: "input_text", text: "synthetic" }] }]
    }) };
    await assert.rejects(openAI(1000, 2000).fetch(endpoint, request), { code: "AI_MONTHLY_BUDGET_LIMIT" });
    assert.deepEqual(await daily(), []);
    assert.equal(calls, 0);
    await openAI(1, 1).fetch(endpoint, request);
    assert.equal(calls, 1);
    assert.equal((await ledger())[0].claudeReservedMicroPln, 20000000n);
    await assert.rejects(reserveClaude(1n, 20000000n, db), { code: "AI_MONTHLY_BUDGET_LIMIT" });
    // The database constraint also guards an older binary that only knows OpenAI.
    await assert.rejects(db.$executeRaw`UPDATE "OpenAIMonthlyBudget" SET "reservedMicroPln" = 190000000
      WHERE "month" = ${month}::date`);
    console.log("Shared AI budget E2E OK: atomic provider reservations, total ceiling, legacy write guard and no provider network");
  } finally {
    try {
      if (fixtureCreated) {
        await db.$executeRaw`DELETE FROM "OpenAIMonthlyBudget" WHERE "month" = ${month}::date`;
        await db.$executeRaw`DELETE FROM "OpenAIRequestBudget" WHERE "day" = ${today}::date`;
      }
    } finally {
      await db.$disconnect();
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
