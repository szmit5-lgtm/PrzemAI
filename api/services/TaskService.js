const prisma = require("../../lib/prisma");
const { GENERAL_SOURCE } = require("../../lib/agentCatalog");
const personalSource = { notIn: ["COMPANY", GENERAL_SOURCE] };

// Task deadlines are calendar dates. Prisma DateTime accepts a Date instance,
// not the date-only YYYY-MM-DD strings produced by <input type="date"> and AI.
function invalidTaskDate() {
    const error = new Error("Nieprawidłowy termin zadania. Podaj datę RRRR-MM-DD.");
    error.code = "INVALID_TASK_DUE_DATE";
    return error;
}

function normalizeTaskDueDate(value) {
    if (value == null || (typeof value === "string" && !value.trim())) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) throw invalidTaskDate();
        return value;
    }
    if (typeof value !== "string") throw invalidTaskDate();

    const input = value.trim();
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input);
    const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input);
    if (!dateOnly && !timestamp) throw invalidTaskDate();

    // Validate calendar dates explicitly: Date() otherwise normalizes 31 February.
    const day = input.slice(0, 10);
    const checked = new Date(day + "T12:00:00.000Z");
    if (Number.isNaN(checked.getTime()) || checked.toISOString().slice(0, 10) !== day) {
        throw invalidTaskDate();
    }

    // UTC noon prevents a date-only deadline from appearing as the previous day
    // in common time zones; no invented hour is shown to the user.
    const date = new Date(dateOnly ? day + "T12:00:00.000Z" : input);
    if (Number.isNaN(date.getTime())) throw invalidTaskDate();
    return date;
}

class TaskService {

    async create(data) {

        return prisma.task.create({

            data: {

                title: data.title,
                description: data.description,
                priority: data.priority || "MEDIUM",
                status: data.status || "TODO",
                dueDate: normalizeTaskDueDate(data.dueDate),
                userId: data.userId

            }

        });

    }

    async list(userId, status = null) {

        return prisma.task.findMany({

            where: {

                userId,
                source: personalSource,

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
                userId,
                source: personalSource

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
        if (Object.prototype.hasOwnProperty.call(changes, "dueDate")) {
            changes.dueDate = normalizeTaskDueDate(changes.dueDate);
        }

        // Scope the write itself to the owner, not only a preceding read.
        // This also removes the read/write authorization race.
        return prisma.task.update({
            where: { id, userId, source: personalSource },
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
            where: { id, userId, source: personalSource }
        });

    }

}

module.exports = new TaskService();