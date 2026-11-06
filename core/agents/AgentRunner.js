"use strict";

const prisma = require("../../lib/prisma");
const FinancialAgent = require("../../agents/financial/FinancialAgent");

const HEARTBEAT_MS = 60 * 1000;
// Keep nextRunAt within a practical range even if stored configuration is corrupted.
const MAX_INTERVAL_MINUTES = 365 * 24 * 60;

class AgentRunner {
  async run(agent, trigger = "SCHEDULE") {
    // An invalid interval must never produce an Invalid Date or a tight retry loop.
    const intervalMinutes = Number.isSafeInteger(agent.intervalMinutes) && agent.intervalMinutes > 0 &&
      agent.intervalMinutes <= MAX_INTERVAL_MINUTES
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
    let lostOwnership = false;
    try {
      run = await prisma.agentRun.create({
        data: { agentId: agent.id, status: "RUNNING", trigger }
      });

      let result;
      if(agent.type==="FINANCIAL"){
        result=await new FinancialAgent().run({userId:agent.userId});
      }else{
        if(typeof agent.key!=="string" || !agent.key.trim())
          throw Error("Nieobsługiwany typ agenta.");
        const {getAgentDefinition}=require("../../lib/agentCatalog");
        const def=getAgentDefinition(agent.key);
        if(!def||def.type!==agent.type||def.mode!=="TASK_DRAFT")
          throw Error("Nieobsługiwany typ agenta.");
        const BusinessTaskAgent=require("../../agents/business/BusinessTaskAgent");
        result=await new BusinessTaskAgent().run({userId:agent.userId,agentKey:agent.key});
      }
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
      const released = await prisma.agent.updateMany({
        where: { id: agent.id, status: "RUNNING" },
        data: {
          status: "IDLE",
          lastRunAt: finishedAt,
          nextRunAt: new Date(finishedAt.getTime() + intervalMinutes * 60000)
        }
      });

      // A stale-run recovery or another worker may have taken ownership.
      // Never report success when this run no longer owns the agent lock.
      if (released.count !== 1) {
        lostOwnership = true;
        throw new Error("Agent run lost ownership before completion.");
      }

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

      // Another worker may already own RUNNING after stale-run recovery.
      // Do not mark that newer execution ERROR when our release lost the claim.
      if (!lostOwnership) try {
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
