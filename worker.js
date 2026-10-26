require("dotenv").config();

const prisma = require("./lib/prisma");
const AgentRunner = require("./core/agents/AgentRunner");
const AgentService = require("./api/services/AgentService");

const runner = new AgentRunner();
const service = new AgentService();

let shuttingDown = false;
let cycleRunning = false;

async function ensureUsers() {
    const users = await prisma.user.findMany({
        select: { id: true }
    });

    for (const user of users) {
        await service.ensureDefaults(user.id);
    }
}

async function runCycle() {
    if (cycleRunning || shuttingDown) {
        return;
    }

    cycleRunning = true;

    try {
        await ensureUsers();

        const dueAgents = await prisma.agent.findMany({
            where: {
                enabled: true,
                OR: [
                    { nextRunAt: null },
                    { nextRunAt: { lte: new Date() } }
                ],
                NOT: {
                    status: "RUNNING"
                }
            },
            orderBy: {
                nextRunAt: "asc"
            }
        });

        for (const agent of dueAgents) {
            const locked = await prisma.agent.updateMany({
                where: {
                    id: agent.id,
                    NOT: {
                        status: "RUNNING"
                    }
                },
                data: {
                    status: "RUNNING"
                }
            });

            if (locked.count !== 1) {
                continue;
            }

            try {
                await runner.run(
                    {
                        ...agent,
                        status: "RUNNING"
                    },
                    "SCHEDULE"
                );
            }
            catch (error) {
                console.error(
                    `[Worker] ${agent.name}: ${error.message}`
                );
            }
        }
    }
    catch (error) {
        console.error("[Worker]", error);
    }
    finally {
        cycleRunning = false;
    }
}

async function shutdown() {
    shuttingDown = true;
    await prisma.$disconnect();
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("PrzemAI Worker uruchomiony.");

runCycle();
setInterval(runCycle, 60 * 1000);
