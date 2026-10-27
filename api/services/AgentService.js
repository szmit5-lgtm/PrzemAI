const prisma = require("../../lib/prisma");
const AgentRunner = require("../../core/agents/AgentRunner");
const { isAuthorizedDekonicaUser } = require("../../lib/mailAccessPolicy");

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

        // The shared company mailbox must never be provisioned for
        // every newly registered account. No owner configured = no access.
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true }
        });
        if (!isAuthorizedDekonicaUser(user?.email)) return;

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
                            "DEKONICA_MAIL_PASSWORD",
                        // The API may create the integration before the
                        // worker (which holds the secret) starts.
                        autoEnablePending:
                            !shouldEnableDekonicaMail
                    }
                }
            });
        }
        else if (
            shouldEnableDekonicaMail &&
            mailIntegration.config?.autoEnablePending === true
        ) {
            await prisma.integration.update({
                where: { id: mailIntegration.id },
                data: {
                    enabled: true,
                    config: {
                        ...mailIntegration.config,
                        autoEnablePending: false
                    }
                }
            });
        }
        // Existing integrations without the pending flag are never
        // auto-enabled: a user's disabled setting must be respected.
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
                enabled: Boolean(enabled),
                // An explicit user choice overrides automatic setup.
                config: {
                    ...integration.config,
                    autoEnablePending: false
                }
            }
        });
    }
}

module.exports = AgentService;
