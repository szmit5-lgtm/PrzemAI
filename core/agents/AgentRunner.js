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
        data: { status: "ERROR" }
      });

      throw error;
    }
  }
}

module.exports = AgentRunner;
