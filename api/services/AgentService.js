const prisma = require("../../lib/prisma");
const AgentRunner = require("../../core/agents/AgentRunner");

class AgentService {
    constructor() {
        this.runner = new AgentRunner();
    }

    async ensureDefaults(userId) {
        await prisma.agent.upsert({
            where: {
                userId_key: {
                    userId,
                    key: "financial"
                }
            },
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

        const mailIntegration =
            await prisma.integration.findFirst({
                where: {
                    userId,
                    type: "MAIL",
                    provider: "HOME_PL",
                    name: "Dekonica office"
                }
            });

        if (!mailIntegration) {
            await prisma.integration.create({
                data: {
                    userId,
                    type: "MAIL",
                    provider: "HOME_PL",
                    name: "Dekonica office",
                    enabled: false,
                    config: {
                        email: "office@dekonica.com",
                        imapHost: "dekonica.com",
                        imapPort: 993,
                        smtpHost: "dekonica.com",
                        smtpPort: 587,
                        passwordEnv:
                            "DEKONICA_MAIL_PASSWORD"
                    }
                }
            });
        }
    }

    async list(userId) {
        await this.ensureDefaults(userId);

        return prisma.agent.findMany({
            where: {
                userId
            },
            orderBy: {
                createdAt: "asc"
            },
            include: {
                runs: {
                    take: 5,
                    orderBy: {
                        startedAt: "desc"
                    }
                }
            }
        });
    }

    async runNow(userId, id) {
        const agent =
            await prisma.agent.findFirst({
                where: {
                    id,
                    userId
                }
            });

        if (!agent) {
            throw new Error(
                "Agent nie istnieje."
            );
        }

        return this.runner.run(
            agent,
            "MANUAL"
        );
    }

    async setEnabled(
        userId,
        id,
        enabled
    ) {
        const agent =
            await prisma.agent.findFirst({
                where: {
                    id,
                    userId
                }
            });

        if (!agent) {
            throw new Error(
                "Agent nie istnieje."
            );
        }

        return prisma.agent.update({
            where: {
                id
            },
            data: {
                enabled:
                    Boolean(enabled),
                status:
                    enabled
                        ? "IDLE"
                        : "DISABLED",
                nextRunAt:
                    enabled
                        ? new Date()
                        : null
            }
        });
    }
}

module.exports = AgentService;
