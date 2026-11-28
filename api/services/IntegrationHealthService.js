const prisma = require("../../lib/prisma");
const { getKsefSyncEligibility } = require("../../lib/ksefSyncEligibility");
const { isAuthorizedDekonicaUser, canSyncMailIntegration } = require("../../lib/mailAccessPolicy");

async function integrationHealth(userId, { db = prisma, env = process.env } = {}) {
    const configured = (...keys) => keys.every(key => Boolean(env[key]?.trim()));
    const row = (name, configuration, evidence = null, latestAt = null) => ({
        name, configuration, evidence, latestAt
    });
    const [mail, bank, telegram, whatsapp, agents, kaldeva, ksef] = await Promise.all([
        isAuthorizedDekonicaUser(userId, env)
            ? db.integration.findFirst({
                where: { userId, type: "MAIL", provider: "HOME_PL", name: "Dekonica office" },
                select: { enabled: true, config: true, type: true, provider: true, lastSyncAt: true }
            })
            : null,
        db.bankStatement.findFirst({
            where: { organization: { status: "ACTIVE", memberships: { some: {
                userId, status: "ACTIVE", OR: [{ role: "OWNER" }, { financeAccess: true }]
            } } } },
            orderBy: { importedAt: "desc" },
            select: { importedAt: true }
        }),
        db.telegramChatReceipt.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
        }),
        configured("WHATSAPP_ORGANIZATION_ID", "WHATSAPP_PHONE_NUMBER_ID")
            ? db.whatsAppMessage.findFirst({
                where: { organizationId: env.WHATSAPP_ORGANIZATION_ID, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
                    direction: "INBOUND", organization: { status: "ACTIVE", memberships: { some: {
                        userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] }
                    } } } },
                orderBy: { receivedAt: "desc" },
                select: { receivedAt: true }
            })
            : null,
        db.agent.groupBy({
            by: ["status"], where: { userId, enabled: true }, _count: { _all: true }
        }),
        db.$queryRaw`
            SELECT "report"->>'status' AS "status", COUNT(*)::int AS "count", MAX("updatedAt") AS "latestAt"
            FROM "History"
            WHERE "userId" = ${userId} AND "type" = 'KALDEVA_SALES'
              AND "report"->>'status' IN ('queued', 'running', 'completed', 'failed')
            GROUP BY "report"->>'status'
        `,
        env.KSEF_OWNER_USER_ID === userId
            ? db.agentRun.findFirst({
                where: { status: "SUCCESS", finishedAt: { not: null }, agent: { userId, key: "financial" }, OR: [
                    { metadata: { path: ["ksefStatus"], equals: "SYNCED" } },
                    { metadata: { path: ["deherusKsefStatus"], equals: "SYNCED" } }
                ] },
                orderBy: { finishedAt: "desc" },
                select: { finishedAt: true }
            })
            : null
    ]);
    const kaldevaByStatus = Object.fromEntries(kaldeva.map(item => [item.status, item]));
    const agentCounts = Object.fromEntries(agents.map(item => [item.status, item._count._all]));
    const mailConfigured = mail && canSyncMailIntegration(userId, mail, env);
    return {
        integrations: [
            row("OpenAI", configured("OPENAI_API_KEY", "OPENAI_PRICE_BOUNDS_JSON") ? "configured" : "unconfirmed"),
            row("Claude", "manual"),
            row("KSeF", getKsefSyncEligibility(userId, env).allowed ? "configured" : "unconfirmed",
                ksef ? "ksefSynced" : null, ksef?.finishedAt),
            row("Banki", "manual", bank ? "importedStatement" : null, bank?.importedAt),
            row("Poczta", mailConfigured ? (!mail.enabled ? "disabled" : configured("DEKONICA_MAIL_PASSWORD") ? "configured" : "unconfirmed") : "unconfirmed",
                mailConfigured && mail.lastSyncAt ? "mailSynced" : null, mailConfigured ? mail.lastSyncAt : null),
            row("Telegram", configured("TELEGRAM_TOKEN", "TELEGRAM_WEBHOOK_SECRET") ? "configured" : "unconfirmed",
                telegram ? "telegramReceipt" : null, telegram?.createdAt),
            row("WhatsApp", configured("WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_ORGANIZATION_ID", "WHATSAPP_PHONE_NUMBER_ID")
                ? "configured" : "unconfirmed", whatsapp ? "whatsAppReceived" : null, whatsapp?.receivedAt),
            row("Kaldeva", "queue", kaldevaByStatus.completed ? "jobCompleted" : null, kaldevaByStatus.completed?.latestAt),
            row("Allegro", "unconfirmed"),
            row("MT5", "unconfirmed")
        ],
        queues: {
            agentsRunning: agentCounts.RUNNING ?? 0,
            agentsInError: agentCounts.ERROR ?? 0,
            kaldevaQueued: kaldevaByStatus.queued?.count ?? 0,
            kaldevaRunning: kaldevaByStatus.running?.count ?? 0,
            kaldevaFailed: kaldevaByStatus.failed?.count ?? 0,
            kaldevaLastFailureAt: kaldevaByStatus.failed?.latestAt ?? null
        }
    };
}

module.exports = { integrationHealth };
