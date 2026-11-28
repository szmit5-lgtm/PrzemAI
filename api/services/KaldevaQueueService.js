const { randomUUID } = require("node:crypto");
const prisma = require("../../lib/prisma");

const KALDEVA_HISTORY_TYPE = "KALDEVA_SALES";
const cooldownMs = 60_000;

async function enqueueDiscovery(actorId, query, db = prisma) {
    return db.$transaction(async tx => {
        // Serialize requests for this account across API replicas. The lock
        // is released on commit or rollback and never survives a process crash.
        await tx.$queryRaw`
            SELECT 1 AS "locked"
            FROM pg_advisory_xact_lock(hashtextextended(${"kaldeva:enqueue:" + actorId}::text, 0))
        `;
        const [{ now }] = await tx.$queryRaw`SELECT clock_timestamp() AS "now"`;
        const where = { userId: actorId, type: KALDEVA_HISTORY_TYPE };
        const cutoff = new Date(now.getTime() - cooldownMs);
        const reusable = await tx.history.findFirst({
            where: { ...where, AND: [
                { report: { path: ["query"], equals: query } },
                { OR: [
                    { report: { path: ["status"], equals: "queued" } },
                    { report: { path: ["status"], equals: "running" } },
                    { updatedAt: { gt: cutoff }, report: { path: ["status"], equals: "completed" } }
                ] }
            ] },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { id: true, report: true }
        });
        if (reusable) return { id: reusable.id, status: reusable.report.status };

        const recent = await tx.history.findFirst({
            where: { ...where, createdAt: { gt: cutoff } },
            select: { id: true }
        });
        if (recent) return null;

        const id = randomUUID();
        await tx.history.create({ data: {
            id, userId: actorId, type: KALDEVA_HISTORY_TYPE, title: "Kaldeva: " + query.slice(0, 150),
            filename: "", createdAt: now,
            report: { id, companyId: "kaldeva:" + actorId, actorId, query, status: "queued", report: null, error: null }
        } });
        return { id, status: "queued" };
    }, { isolationLevel: "ReadCommitted" });
}

module.exports = { KALDEVA_HISTORY_TYPE, enqueueDiscovery };
