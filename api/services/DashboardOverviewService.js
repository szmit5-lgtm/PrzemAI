const prisma = require("../../lib/prisma");
const { GENERAL_SOURCE } = require("../../lib/agentCatalog");

async function getDashboardOverview(userId, db = prisma) {
    const [summary] = await db.$queryRaw`
        SELECT
            COUNT(*) FILTER (WHERE "status" <> 'DONE')::int AS "openTasks",
            COUNT(*) FILTER (WHERE "status" = 'DONE')::int AS "completedTasks",
            COUNT(*) FILTER (WHERE "status" <> 'DONE' AND "dueDate" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int AS "overdueTasks"
        FROM "Task"
        WHERE "userId" = ${userId}
          AND "source" NOT IN ('COMPANY', ${GENERAL_SOURCE})
          AND "investmentId" IS NULL
          AND NOT "investmentScoped"
    `;
    return { summary };
}

module.exports = { getDashboardOverview };
