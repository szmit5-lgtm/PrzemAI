const prisma = require("../../lib/prisma");

class FinanceService {
    async list(userId, options = {}) {
        const limit = Math.min(
            Math.max(Math.trunc(Number(options.limit)) || 100, 1),
            500
        );

        // Keep the page bounded and never allow a negative or fractional offset.
        const offsetValue = Number(options.offset);
        const offset = Number.isFinite(offsetValue)
            ? Math.min(Math.max(Math.trunc(offsetValue), 0), 100000)
            : 0;

        const where = {
            userId
        };

        if (options.status) {
            where.status = options.status;
        }

        if (options.source) {
            where.source = options.source;
        }

        const items = await prisma.financialDocument.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: [
                { issueDate: "desc" },
                { createdAt: "desc" },
                { id: "desc" }
            ],
            include: {
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        return items.map(item => ({
            ...item,
      // Full KSeF XML is available only from the single-document endpoint.
      rawData: item.source === "KSEF" ? null : item.rawData,
            netAmount:
                item.netAmount?.toString() || null,
            vatAmount:
                item.vatAmount?.toString() || null,
            grossAmount:
                item.grossAmount?.toString() || null
        }));
    }

    async one(userId, id) {
        if (typeof id !== "string" || !id.trim() || id.length > 128) return null;
        const document = await prisma.financialDocument.findFirst({
            where: { id, userId },
            include: { project: { select: { id: true, name: true } } }
        });
        if (!document) return null;
        return {
            ...document,
            netAmount: document.netAmount?.toString() || null,
            vatAmount: document.vatAmount?.toString() || null,
            grossAmount: document.grossAmount?.toString() || null
        };
    }

    async summary(userId) {
        const [
            total,
            newCount,
            mailCount,
            ksefCount
        ] = await Promise.all([
            prisma.financialDocument.count({
                where: { userId }
            }),
            prisma.financialDocument.count({
                where: {
                    userId,
                    status: "NEW"
                }
            }),
            prisma.financialDocument.count({
                where: {
                    userId,
                    source: "MAIL"
                }
            }),
            prisma.financialDocument.count({
                where: {
                    userId,
                    source: "KSEF"
                }
            })
        ]);

        const summary = { total, new: newCount, mail: mailCount, ksef: ksefCount };
        if (typeof prisma.financialDocument.groupBy !== "function") return summary;
        const rows = await prisma.financialDocument.groupBy({
            by: ["currency", "direction"],
            where: { userId, source: "KSEF" },
            _sum: { netAmount: true, vatAmount: true, grossAmount: true },
            _count: { _all: true }
        });
        return {
            ...summary,
            amounts: rows.map(row => ({
                currency: row.currency,
                direction: row.direction,
                count: row._count._all,
                net: row._sum.netAmount?.toString() || null,
                vatPLN: row._sum.vatAmount?.toString() || null,
                gross: row._sum.grossAmount?.toString() || null
            }))
        };
    }
}

module.exports = FinanceService;
