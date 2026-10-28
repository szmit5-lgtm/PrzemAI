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

        // Never pass arbitrary request bodies into Prisma. In particular,
        // userId, id, source and relation writes must not be client-editable.
        const allowed = new Set([
            "title", "description", "priority", "status", "dueDate",
            "startedAt", "completedAt", "tags", "owner", "metadata"
        ]);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Nieprawidłowe dane zadania.");
        }
        const changes = {};
        for (const [key, value] of Object.entries(data)) {
            if (!allowed.has(key)) {
                throw new Error("Niedozwolone pole aktualizacji zadania.");
            }
            changes[key] = value;
        }
        if (Object.keys(changes).length === 0) {
            throw new Error("Brak danych do aktualizacji zadania.");
        }
        if (changes.dueDate === "") changes.dueDate = null;

        // Scope the write itself to the owner, not only a preceding read.
        // This also removes the read/write authorization race.
        return prisma.task.update({
            where: { id, userId },
            data: changes
        });

    }

    async complete(id, userId) {

        return this.update(id, userId, {

            status: "DONE",
            completedAt: new Date()

        });

    }

    async remove(id, userId) {

        // Authorization belongs in the DELETE predicate as well.
        return prisma.task.delete({
            where: { id, userId }
        });

    }

}

module.exports = new TaskService();