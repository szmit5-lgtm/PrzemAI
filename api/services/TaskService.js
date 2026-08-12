const prisma = require("../../lib/prisma");

class TaskService {

    async create(data) {

        return prisma.task.create({

            data: {

                title: data.title,
                description: data.description,
                priority: data.priority || "MEDIUM",
                status: data.status || "TODO",
                dueDate: data.dueDate || null,
                userId: data.userId

            }

        });

    }

    async list(userId, status = null) {

        return prisma.task.findMany({

            where: {

                userId,

                ...(status ? { status } : {})

            },

            orderBy: [

                {
                    status: "asc"
                },

                {
                    priority: "desc"
                },

                {
                    dueDate: "asc"
                },

                {
                    createdAt: "desc"
                }

            ]

        });

    }

    async get(id, userId) {

        return prisma.task.findFirst({

            where: {

                id,
                userId

            }

        });

    }

    async update(id, userId, data) {

        const task = await this.get(id, userId);

        if (!task) {

            throw new Error("Zadanie nie istnieje.");

        }

        return prisma.task.update({

            where: {

                id

            },

            data

        });

    }

    async complete(id, userId) {

        return this.update(id, userId, {

            status: "DONE",
            completedAt: new Date()

        });

    }

    async remove(id, userId) {

        const task = await this.get(id, userId);

        if (!task) {

            throw new Error("Zadanie nie istnieje.");

        }

        return prisma.task.delete({

            where: {

                id

            }

        });

    }

}

module.exports = new TaskService();