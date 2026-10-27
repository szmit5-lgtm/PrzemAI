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

        const shouldEnableDekonicaMail =
            Boolean(process.env.DEKONICA_MAIL_PASSWORD);

        if (!mailIntegration) {
            await prisma.integration.create({
                data: {
                    userId,
                    type: "MAIL",
                    provider: "HOME_PL",
                    name: "Dekonica office",
                    enabled: shouldEnableDekonicaMail,
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
        // Respect an existing integration's enabled flag. A user who
        // disabled mailbox access must not be silently re-enabled.
    }

    async list(userId) {
        await this.ensureDefaults(userId);

        return prisma.agent.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
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
        const agent = await prisma.agent.findFirst({
            where: { id, userId }
        });

        if (!agent) {
            throw new Error(
                "Agent nie istnieje."
            );
        }

        const lock = await prisma.agent.updateMany({
            where: {
                id,
                userId,
                enabled: true,
                NOT: { status: "RUNNING" }
            },
            data: { status: "RUNNING" }
        });

        if (lock.count !== 1) {
            throw new Error(
                "Agent jest wyłączony albo już działa."
            );
        }

        return this.runner.run(
            { ...agent, status: "RUNNING" },
            "MANUAL"
        );
    }

    async setEnabled(
        userId,
        id,
        enabled
    ) {
        const agent = await prisma.agent.findFirst({
            where: { id, userId }
        });

        if (!agent) {
            throw new Error(
                "Agent nie istnieje."
            );
        }

        return prisma.agent.update({
            where: { id },
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

    async listIntegrations(userId) {
        await this.ensureDefaults(userId);

        return prisma.integration.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" }
        });
    }

    async setIntegrationEnabled(
        userId,
        id,
        enabled
    ) {
        const integration =
            await prisma.integration.findFirst({
                where: { id, userId }
            });

        if (!integration) {
            throw new Error(
                "Integracja nie istnieje."
            );
        }

        return prisma.integration.update({
            where: { id },
            data: {
                enabled:
                    Boolean(enabled)
            }
        });
    }
}

module.exports = AgentService;
