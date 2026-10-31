"use strict";

// Read-only staging readiness check. Never prints user identifiers or secrets.
require("dotenv").config();
const prisma = require("../lib/prisma");
const { buildStagingReadiness, SUPPORTED_RUNTIME_TYPES } = require("../lib/stagingAgentReadiness");
const { stagingDiagnosticContext } = require("../lib/stagingDiagnosticGuard");

async function main() {
  const context = stagingDiagnosticContext(process.env);

  const [users, agents, runs, successfulSupportedRuns] = await Promise.all([
    prisma.user.count(),
    prisma.agent.groupBy({ by: ["type", "status", "enabled"], _count: { _all: true } }),
    prisma.agentRun.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.agentRun.count({ where: { status: "SUCCESS", agent: { type: { in: [...SUPPORTED_RUNTIME_TYPES] } } } })
  ]);

  const output = {
    ...buildStagingReadiness({ users, agents, runs, successfulSupportedRuns }),
    railwayEnvironment: context.railwayEnvironment,
    databaseIsolationVerified: context.databaseIsolationVerified
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  if (!output.readyForScheduledTests) process.exitCode = 2;
}

main().catch(error => {
  console.error("[Staging readiness] Failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
