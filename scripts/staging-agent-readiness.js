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
    ...buildStagingReadiness({
      users, agents, runs, successfulSupportedRuns,
      databaseIsolationVerified: context.databaseIsolationVerified
    }),
    railwayEnvironment: context.railwayEnvironment,
    databaseIsolationVerified: context.databaseIsolationVerified
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  // A successful exit must never authorize tests that may write to production data.
  if (!output.safeToRunStagingWrites) process.exitCode = 2;
}

main().catch(error => {
  // Only allow known, credential-free guard messages; database errors may contain URLs or secrets.
  const safeMessages = new Set([
    "Read-only diagnostic is restricted to the verified PrzemAI staging services.",
    "Local read-only diagnostic requires explicit opt-in."
  ]);
  console.error("[Staging readiness] Failed:", safeMessages.has(error?.message)
    ? error.message : "Diagnostic failed; inspect restricted service diagnostics.");
  process.exitCode = 1;
}).finally(async () => {
  try {
    await prisma.$disconnect();
  } catch {
    // Prisma disconnect failures can contain connection strings or credentials.
    console.error("[Staging readiness] Failed: Database disconnect failed.");
    process.exitCode = 1;
  }
});
