require("dotenv").config();

const prisma = require("./lib/prisma");
const AgentRunner = require("./core/agents/AgentRunner");
const AgentService = require("./api/services/AgentService");

const runner = new AgentRunner();
const service = new AgentService();

const CYCLE_MS = 60000;
const STALE_RUN_MS = 90 * 60000;
const MAX_AGENTS_PER_CYCLE = 50;

let busy = false;
let stopping = false;
let cycleNumber = 0;
let interval;
let warnedNoUsers = false;

async function recoverStaleRuns() {
  const cutoff = new Date(Date.now() - STALE_RUN_MS);
  const stale = await prisma.agent.findMany({
    where: { status: "RUNNING", updatedAt: { lt: cutoff } },
    select: { id: true },
    // Process oldest abandoned runs first without monopolizing the scheduler.
    orderBy: { updatedAt: "asc" },
    take: MAX_AGENTS_PER_CYCLE
  });

  let recovered = 0;
  for (const agent of stale) {
    try {
      const now = new Date();
      const lock = await prisma.agent.updateMany({
        where: {
          id: agent.id,
          status: "RUNNING",
          updatedAt: { lt: cutoff }
        },
        data: { status: "ERROR", nextRunAt: now }
      });

      if (lock.count !== 1) continue;

      // A failed audit write must not stop recovery of other agents or
      // prevent the scheduler from processing healthy users.
      try {
        await prisma.agentRun.updateMany({
          where: { agentId: agent.id, status: "RUNNING" },
          data: {
            status: "FAILED",
            finishedAt: now,
            error: "Przerwane uruchomienie; odzyskano po utracie workera."
          }
        });
      } catch (error) {
        console.error("[Worker] Failed to update stale run audit", agent.id, error.message);
      }

      recovered += 1;
      console.warn("[Worker] Recovered stale run", agent.id);
    } catch (error) {
      console.error("[Worker] Failed to recover stale agent", agent.id, error.message);
    }
  }

  return recovered;
}

async function cycle() {
  if (busy || stopping) return;
  busy = true;

  try {
    let recovered = 0;
    try {
      recovered = await recoverStaleRuns();
    } catch (error) {
      // A failed stale-run scan must not prevent healthy agents from running.
      console.error("[Worker] Stale run scan failed", error.message);
    }
    const users = await prisma.user.findMany({
      select: { id: true }
    });

    if (users.length === 0 && !warnedNoUsers) {
      console.warn("[Worker] No users in this database. Scheduled user agents cannot run until a staging user is provisioned.");
      warnedNoUsers = true;
    } else if (users.length > 0) {
      warnedNoUsers = false;
    }

    for (const user of users) {
      if (stopping) break;
      try {
        await service.ensureDefaults(user.id);
      } catch (error) {
        // A single broken account must not prevent other users' agents
        // from running during this cycle.
        console.error("[Worker] Failed to ensure default agents for a user", error.message);
      }
    }

    const due = stopping ? [] : await prisma.agent.findMany({
      where: {
        enabled: true,
        OR: [
          { nextRunAt: null },
          { nextRunAt: { lte: new Date() } }
        ],
        NOT: { status: "RUNNING" }
      },
      orderBy: { nextRunAt: "asc" },
      // Avoid unbounded reads when many agents become due simultaneously.
      take: MAX_AGENTS_PER_CYCLE
    });

    let completed = 0;
    let failed = 0;

    for (const agent of due) {
      if (stopping) break;

      // Recheck the due condition when claiming the agent. Another
      // worker may have finished and rescheduled it after findMany.
      let lock;
      try {
        lock = await prisma.agent.updateMany({
          where: {
            id: agent.id,
            enabled: true,
            NOT: { status: "RUNNING" },
            OR: [
              { nextRunAt: null },
              { nextRunAt: { lte: new Date() } }
            ]
          },
          data: { status: "RUNNING" }
        });
      } catch (error) {
        // A transient database error claiming one agent must not prevent
        // other due agents from running in the same scheduler cycle.
        failed += 1;
        console.error("[Worker] Failed to claim agent", agent.key, error.message);
        continue;
      }

      if (lock.count !== 1) continue;

      // AgentRunner heartbeats both scheduled and manual executions.
      try {
        await runner.run({ ...agent, status: "RUNNING" }, "SCHEDULE");
        completed += 1;
      } catch (error) {
        failed += 1;
        console.error("[Worker] Agent failed", agent.key, error.message);
      }
    }

    cycleNumber += 1;
    if (cycleNumber === 1 || cycleNumber % 15 === 0 ||
        completed || failed || recovered) {
      console.log("[Worker] Cycle", JSON.stringify({
        users: users.length,
        due: due.length,
        completed,
        failed,
        recovered
      }));
    }
  } catch (error) {
    console.error("[Worker] Cycle failed", error.message);
  } finally {
    busy = false;
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);

  // Railway sends SIGTERM during deployments. Give the active
  // cycle a short chance to finish before disconnecting.
  const deadline = Date.now() + 25000;
  while (busy && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  if (busy) {
    console.warn("[Worker] Shutdown deadline reached while a cycle is active; unfinished runs will be recovered by the stale-run watchdog.");
  }

  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (process.env.DEKONICA_MAIL_PASSWORD && !process.env.DEKONICA_MAIL_OWNER_USER_ID?.trim()) {
  console.warn("[Worker] Shared mailbox secret is configured but DEKONICA_MAIL_OWNER_USER_ID is missing. Mail access remains disabled until an authorized staging user is configured.");
}

console.log("PrzemAI Worker active");
cycle();
interval = setInterval(cycle, CYCLE_MS);

// Staging deployment marker: Claude API smoke test is configured as a one-time pre-deploy check.
