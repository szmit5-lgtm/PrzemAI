const prisma = require("../../lib/prisma");
const AgentRunner = require("../../core/agents/AgentRunner");

class AgentService {
  constructor() {
    this.runner = new AgentRunner();
  }

  async ensureDefaults(userId) {
    await prisma.agent.upsert({
      where: { userId_key: { userId, key: "financial" } },
      update: {},
      create: {
        userId,
        key: "financial",
        name: "Financial Agent",
        type: "FINANCIAL",
        enabled: true,
        status: "IDLE",
        intervalMinutes: 15,
        nextRunAt: new Date()
      }
    });
  }

  async list(userId) {
    await this.ensureDefaults(userId);

    return prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        runs: {
          take: 5,
          orderBy: { startedAt: "desc" }
        }
      }
    });
  }

  async runNow(userId, id) {
    const agent = await prisma.agent.findFirst({
      where: { id, userId }
    });

    if (!agent) {
      throw new Error("Agent nie istnieje.");
    }

    return this.runner.run(agent, "MANUAL");
  }

  async setEnabled(userId, id, enabled) {
    const agent = await prisma.agent.findFirst({
      where: { id, userId }
    });

    if (!agent) {
      throw new Error("Agent nie istnieje.");
    }

    return prisma.agent.update({
      where: { id },
      data: {
        enabled: Boolean(enabled),
        status: enabled ? "IDLE" : "DISABLED",
        nextRunAt: enabled ? new Date() : null
      }
    });
  }
}

module.exports = AgentService;
