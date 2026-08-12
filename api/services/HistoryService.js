const prisma = require("../../lib/prisma");

class HistoryService {

    async create(data) {

        return prisma.history.create({

            data: {

                title: data.title,

                filename: data.filename,

                type: data.type,

                report: data.report,

                userId: data.userId

            }

        });

    }

    async list(userId) {

        return prisma.history.findMany({

            where: {

                userId

            },

            orderBy: {

                createdAt: "desc"

            },

            select: {

                id: true,
                title: true,
                filename: true,
                type: true,
                createdAt: true

            }

        });

    }

    async get(id, userId) {

        return prisma.history.findFirst({

            where: {

                id,
                userId

            }

        });

    }

    async remove(id, userId) {

        const item = await prisma.history.findFirst({

            where: {

                id,
                userId

            }

        });

        if (!item) {

            throw new Error("Analiza nie istnieje.");

        }

        return prisma.history.delete({

            where: {

                id

            }

        });

    }

}

module.exports = new HistoryService();