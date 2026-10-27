const prisma = require("../../lib/prisma");

class FinanceService {
    async list(userId, options = {}) {
        const limit = Math.min(
            Math.max(Number(options.limit) || 100, 1),
            500
        );

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
            orderBy: [
                { issueDate: "desc" },
                { createdAt: "desc" }
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
            netAmount:
                item.netAmount?.toString() || null,
            vatAmount:
                item.vatAmount?.toString() || null,
            grossAmount:
                item.grossAmount?.toString() || null
        }));
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

        return {
            total,
            new: newCount,
            mail: mailCount,
            ksef: ksefCount
        };
    }
}

module.exports = FinanceService;
