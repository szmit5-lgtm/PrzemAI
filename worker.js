require("dotenv").config();

const prisma = require("./lib/prisma");
const AgentRunner = require("./core/agents/AgentRunner");
const AgentService = require("./api/services/AgentService");

const runner = new AgentRunner();
const service = new AgentService();

let busy = false;

async function cycle() {
  if (busy) {
    return;
  }

  busy = true;

  try {
    const users = await prisma.user.findMany({
      select: { id: true }
    });

    for (const user of users) {
      await service.ensureDefaults(user.id);
    }

    const due = await prisma.agent.findMany({
      where: {
        enabled: true,
        OR: [
          { nextRunAt: null },
          { nextRunAt: { lte: new Date() } }
        ],
        NOT: { status: "RUNNING" }
      },
      orderBy: { nextRunAt: "asc" }
    });

    for (const agent of due) {
      const lock = await prisma.agent.updateMany({
        where: {
          id: agent.id,
          NOT: { status: "RUNNING" }
        },
        data: { status: "RUNNING" }
      });

      if (lock.count !== 1) {
        continue;
      }

      try {
        await runner.run(
          { ...agent, status: "RUNNING" },
          "SCHEDULE"
        );
      } catch (error) {
        console.error("[Worker]", agent.name, error.message);
      }
    }
  } catch (error) {
    console.error("[Worker]", error);
  } finally {
    busy = false;
  }
}

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("PrzemAI Worker active");
cycle();
setInterval(cycle, 60000);
