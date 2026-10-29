"use strict";

const prisma = require("../../lib/prisma");
const FinancialAgent = require("../../agents/financial/FinancialAgent");

const HEARTBEAT_MS = 60 * 1000;

class AgentRunner {
  async run(agent, trigger = "SCHEDULE") {
    // An invalid interval must never produce an Invalid Date or a tight retry loop.
    const intervalMinutes = Number.isSafeInteger(agent.intervalMinutes) && agent.intervalMinutes > 0
      ? agent.intervalMinutes : 15;
    // Both scheduled and manual runs need a heartbeat. Otherwise the worker
    // can reclaim a long manual run after 90 minutes and start it twice.
    const heartbeat = setInterval(() => {
      prisma.agent.updateMany({
        where: { id: agent.id, status: "RUNNING" },
        data: { updatedAt: new Date() }
      }).catch(error => {
        console.error("[AgentRunner] Heartbeat failed", error.message);
      });
    }, HEARTBEAT_MS);
    heartbeat.unref?.();

    let run;
    try {
      run = await prisma.agentRun.create({
        data: { agentId: agent.id, status: "RUNNING", trigger }
      });

      if (agent.type !== "FINANCIAL") {
        throw new Error("Nieobsługiwany typ agenta.");
      }

      const result = await new FinancialAgent().run({ userId: agent.userId });
      const finishedAt = new Date();

      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          finishedAt,
          summary: result.summary || null,
          metadata: result.metadata || undefined
        }
      });

      // A recovered/stopped run must not overwrite a newer agent state.
      await prisma.agent.updateMany({
        where: { id: agent.id, status: "RUNNING" },
        data: {
          status: "IDLE",
          lastRunAt: finishedAt,
          nextRunAt: new Date(finishedAt.getTime() + intervalMinutes * 60000)
        }
      });

      return result;
    } catch (error) {
      // Even if creating AgentRun failed, release the RUNNING claim. A failed
      // audit write must not strand the agent until the stale-run watchdog.
      if (run) {
        try {
          await prisma.agentRun.update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              error: error.message
            }
          });
        } catch (auditError) {
          console.error("[AgentRunner] Could not record failure", auditError.message);
        }
      }

      try {
        await prisma.agent.updateMany({
          where: { id: agent.id, status: "RUNNING" },
          data: {
            status: "ERROR",
            // Avoid retrying a failing integration every minute.
            nextRunAt: new Date(
              Date.now() + Math.max(5, intervalMinutes) * 60000
            )
          }
        });
      } catch (unlockError) {
        console.error("[AgentRunner] Could not release failed agent", unlockError.message);
      }

      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }
}

module.exports = AgentRunner;
