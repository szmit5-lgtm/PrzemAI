"use strict";

// Read-only staging readiness check. Never prints user identifiers or secrets.
require("dotenv").config();
const prisma = require("../lib/prisma");
const { buildStagingReadiness } = require("../lib/stagingAgentReadiness");

async function main() {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "staging" &&
      process.env.PRZEMAI_ALLOW_LOCAL_DIAGNOSTIC !== "true") {
    throw new Error("Diagnostic is restricted to Railway staging or explicitly opted-in local use.");
  }

  const [users, agents, runs] = await Promise.all([
    prisma.user.count(),
    prisma.agent.groupBy({ by: ["type", "status", "enabled"], _count: { _all: true } }),
    prisma.agentRun.groupBy({ by: ["status"], _count: { _all: true } })
  ]);

  const output = buildStagingReadiness({ users, agents, runs });
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  if (!output.readyForScheduledTests) process.exitCode = 2;
}

main().catch(error => {
  console.error("[Staging readiness] Failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
