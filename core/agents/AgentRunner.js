const prisma = require("../../lib/prisma");
const FinancialAgent = require("../../agents/financial/FinancialAgent");

class AgentRunner {
  async run(agent, trigger = "SCHEDULE") {
    const run = await prisma.agentRun.create({
      data: { agentId: agent.id, status: "RUNNING", trigger }
    });

    try {
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

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: "IDLE",
          lastRunAt: finishedAt,
          nextRunAt: new Date(finishedAt.getTime() + agent.intervalMinutes * 60000)
        }
      });

      return result;
    } catch (error) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: error.message
        }
      });

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: "ERROR",
          // Avoid retrying a failing integration every minute.
          nextRunAt: new Date(
            Date.now() +
              Math.max(5, Number(agent.intervalMinutes) || 15) * 60000
          )
        }
      });

      throw error;
    }
  }
}

module.exports = AgentRunner;
