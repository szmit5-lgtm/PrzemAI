"use strict";

const prisma = require("../../lib/prisma");
const { OwnerBriefingService } = require("./OwnerBriefingService");
const { OrganizationError } = require("./OrganizationService");

const defaultTime = "07:00";
const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit"
});
const clockFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

class OwnerDailyBriefingService {
    constructor({ db = prisma, briefing = new OwnerBriefingService({ db }) } = {}) {
        this.db = db;
        this.briefing = briefing;
    }

    async setSchedule(userId, time) {
        if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
            throw new OrganizationError("Podaj godzinę w formacie GG:MM.", 400);
        const owner = await this.db.organizationMembership.findFirst({
            where: { userId, role: "OWNER", status: "ACTIVE", organization: { status: "ACTIVE" } },
            select: { id: true }
        });
        if (!owner) throw new OrganizationError("Wymagany dostęp właściciela spółki.", 403);
        await this.db.ownerBriefingSchedule.upsert({
            where: { userId }, create: { userId, localTime: time }, update: { localTime: time }
        });
        return { time };
    }

    async decorate(userId, report) {
        if (!report.companies.length) return report;
        const day = new Date(report.day + "T00:00:00Z");
        const previous = new Date(day.getTime() - 86400000);
        const [schedule, snapshots] = await Promise.all([
            this.db.ownerBriefingSchedule.findUnique({ where: { userId }, select: { localTime: true } }),
            this.db.ownerDailyBriefing.findMany({
                where: { userId, day: { in: [day, previous] }, completedAt: { not: null } },
                select: { day: true, completedAt: true, snapshot: true }
            })
        ]);
        const visible = new Map(report.companies.map(company => {
            const count = report.alerts.filter(alert => alert.organizationId === company.id &&
                alert.kind === "taskOverdue" && alert.status === "OPEN").length;
            return [company.id, { name: company.name, count }];
        }));
        const today = snapshots.find(row => row.day.getTime() === day.getTime());
        const yesterday = snapshots.find(row => row.day.getTime() === previous.getTime());
        const comparison = Array.isArray(yesterday?.snapshot) ? yesterday.snapshot.flatMap(row => {
            const company = visible.get(row.organizationId);
            return company ? [{ name: company.name, previous: row.overdueTasks, current: company.count }] : [];
        }) : [];
        return { ...report, scheduledTime: schedule?.localTime || defaultTime,
            generatedAt: today?.completedAt || null, comparison };
    }

    async runDue({ now = new Date(), ownerId = null, shouldStop = () => false } = {}) {
        const day = dayFormat.format(now);
        const localTime = clockFormat.format(now);
        const stale = new Date(now.getTime() - 15 * 60 * 1000);
        const candidates = await this.db.$queryRaw`
            SELECT DISTINCT m."userId"
            FROM "OrganizationMembership" m JOIN "Organization" o ON o."id" = m."organizationId"
            LEFT JOIN "OwnerBriefingSchedule" p ON p."userId" = m."userId"
            LEFT JOIN "OwnerDailyBriefing" s ON s."userId" = m."userId" AND s."day" = ${day}::date
            WHERE m."status" = 'ACTIVE' AND m."role" = 'OWNER' AND o."status" = 'ACTIVE'
              AND (${ownerId}::text IS NULL OR m."userId" = ${ownerId})
              AND COALESCE(p."localTime", '07:00') <= ${localTime}
              AND (s."userId" IS NULL OR (s."completedAt" IS NULL AND s."startedAt" < ${stale}))
            ORDER BY m."userId" LIMIT 5
        `;
        for (const { userId } of candidates) {
            if (shouldStop()) break;
            const claimed = await this.db.$executeRaw`
                INSERT INTO "OwnerDailyBriefing" ("userId", "day", "startedAt")
                VALUES (${userId}, ${day}::date, ${now})
                ON CONFLICT ("userId", "day") DO UPDATE SET "startedAt" = EXCLUDED."startedAt"
                WHERE "OwnerDailyBriefing"."completedAt" IS NULL AND "OwnerDailyBriefing"."startedAt" < ${stale}
            `;
            if (claimed !== 1 || shouldStop()) continue;
            try {
                const report = await this.briefing.read(userId, now);
                const snapshot = report.companies.map(company => ({
                    organizationId: company.id,
                    overdueTasks: report.alerts.filter(alert => alert.organizationId === company.id &&
                        alert.kind === "taskOverdue" && alert.status === "OPEN").length
                }));
                await this.db.ownerDailyBriefing.updateMany({
                    where: { userId, day: new Date(day + "T00:00:00Z"), completedAt: null, startedAt: now },
                    data: { completedAt: new Date(), snapshot }
                });
            } catch (error) {
                console.error("[Owner briefing scheduler] Snapshot failed", error?.name, error?.code);
            }
        }
    }
}

module.exports = { OwnerDailyBriefingService };
