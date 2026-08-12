const prisma = require("../../lib/prisma");

class MemoryService {

    normalizeImportance(value, fallback = 3) {

        const importance = Number(value);

        if (!Number.isFinite(importance)) {
            return fallback;
        }

        return Math.min(
            5,
            Math.max(
                1,
                Math.round(importance)
            )
        );

    }

    normalizeTags(tags) {

        if (!Array.isArray(tags)) {
            return [];
        }

        return Array.from(
            new Set(
                tags
                    .filter(tag =>
                        typeof tag === "string" &&
                        tag.trim()
                    )
                    .map(tag =>
                        tag.trim().slice(0, 100)
                    )
            )
        ).slice(0, 30);

    }

    normalizeType(type) {

        if (
            typeof type !== "string" ||
            !type.trim()
        ) {
            return "OTHER";
        }

        return type
            .trim()
            .toUpperCase()
            .slice(0, 50);

    }

    async create(userId, data) {

        if (
            !data.title ||
            !data.title.trim()
        ) {
            throw new Error(
                "Tytuł pamięci jest wymagany."
            );
        }

        if (
            !data.content ||
            !data.content.trim()
        ) {
            throw new Error(
                "Treść pamięci jest wymagana."
            );
        }

        return prisma.memory.create({

            data: {

                userId,

                type: this.normalizeType(
                    data.type
                ),

                title: data.title
                    .trim()
                    .slice(0, 200),

                content: data.content.trim(),

                source:
                    typeof data.source === "string" &&
                    data.source.trim()
                        ? data.source
                            .trim()
                            .toUpperCase()
                        : "MANUAL",

                importance:
                    this.normalizeImportance(
                        data.importance
                    ),

                tags:
                    this.normalizeTags(
                        data.tags
                    ),

                metadata:
                    data.metadata || null

            }

        });

    }

    async list(userId) {

        return prisma.memory.findMany({

            where: {

                userId,
                archivedAt: null

            },

            orderBy: [

                {
                    importance: "desc"
                },

                {
                    updatedAt: "desc"
                }

            ]

        });

    }

    async get(userId, id) {

        return prisma.memory.findFirst({

            where: {

                id,
                userId,
                archivedAt: null

            }

        });

    }

    async update(userId, id, data) {

        const existing =
            await this.get(
                userId,
                id
            );

        if (!existing) {

            throw new Error(
                "Wspomnienie nie istnieje."
            );

        }

        const updateData = {};

        if (data.type !== undefined) {

            updateData.type =
                this.normalizeType(
                    data.type
                );

        }

        if (data.title !== undefined) {

            if (
                typeof data.title !== "string" ||
                !data.title.trim()
            ) {

                throw new Error(
                    "Tytuł pamięci nie może być pusty."
                );

            }

            updateData.title =
                data.title
                    .trim()
                    .slice(0, 200);

        }

        if (data.content !== undefined) {

            if (
                typeof data.content !== "string" ||
                !data.content.trim()
            ) {

                throw new Error(
                    "Treść pamięci nie może być pusta."
                );

            }

            updateData.content =
                data.content.trim();

        }

        if (data.importance !== undefined) {

            updateData.importance =
                this.normalizeImportance(
                    data.importance,
                    existing.importance
                );

        }

        if (data.tags !== undefined) {

            updateData.tags =
                this.normalizeTags(
                    data.tags
                );

        }

        if (data.metadata !== undefined) {

            updateData.metadata =
                data.metadata;

        }

        return prisma.memory.update({

            where: {
                id
            },

            data: updateData

        });

    }

    async findSimilar(userId, memory) {

        if (
            !memory ||
            !memory.title ||
            !memory.content
        ) {

            return null;

        }

        return prisma.memory.findFirst({

            where: {

                userId,
                archivedAt: null,

                OR: [

                    {
                        title: {
                            equals:
                                memory.title.trim(),
                            mode: "insensitive"
                        }
                    },

                    {
                        content: {
                            equals:
                                memory.content.trim(),
                            mode: "insensitive"
                        }
                    }

                ]

            }

        });

    }

    async upsertMemory(
        userId,
        memory
    ) {

        const existing =
            await this.findSimilar(
                userId,
                memory
            );

        if (existing) {

            return prisma.memory.update({

                where: {
                    id: existing.id
                },

                data: {

                    type:
                        this.normalizeType(
                            memory.type ||
                            existing.type
                        ),

                    title:
                        memory.title
                            ? memory.title
                                .trim()
                                .slice(0, 200)
                            : existing.title,

                    content:
                        memory.content
                            ? memory.content.trim()
                            : existing.content,

                    source:
                        memory.source ||
                        existing.source,

                    importance:
                        Math.max(
                            existing.importance,
                            this.normalizeImportance(
                                memory.importance,
                                existing.importance
                            )
                        ),

                    tags:
                        this.mergeTags(
                            existing.tags,
                            memory.tags
                        )

                }

            });

        }

        return this.create(
            userId,
            memory
        );

    }

    async saveExtractedMemories(
        userId,
        memories
    ) {

        if (!Array.isArray(memories)) {
            return [];
        }

        const saved = [];

        for (const memory of memories) {

            if (
                !memory ||
                !memory.title ||
                !memory.content
            ) {
                continue;
            }

            const item =
                await this.upsertMemory(
                    userId,
                    memory
                );

            saved.push(item);

        }

        return saved;

    }

    async archive(userId, id) {

        const memory =
            await this.get(
                userId,
                id
            );

        if (!memory) {

            throw new Error(
                "Wspomnienie nie istnieje."
            );

        }

        return prisma.memory.update({

            where: {
                id
            },

            data: {
                archivedAt: new Date()
            }

        });

    }

    mergeTags(
        existing = [],
        incoming = []
    ) {

        return this.normalizeTags([

            ...(Array.isArray(existing)
                ? existing
                : []),

            ...(Array.isArray(incoming)
                ? incoming
                : [])

        ]);

    }

}

module.exports = new MemoryService();