const prisma = require("../../lib/prisma");
const AIEngine = require("../../core/ai/AIEngine");

const TaskService = require("./TaskService");
const MemoryService = require("./MemoryService");
const SettingsService = require("./SettingsService");

class ChatService {

    constructor() {

        this.ai = new AIEngine();

    }

    async chat(userId, message, conversationId = null) {

        const settings =
            await SettingsService.get(userId);

        const conversation =
            await this.getOrCreateConversation(
                userId,
                conversationId,
                message
            );

        await this.createMessage(
            conversation.id,
            "user",
            message
        );

        const [
            tasks,
            history,
            memories,
            previousMessages
        ] = await Promise.all([

            settings.executiveMode
                ? TaskService.list(userId)
                : Promise.resolve([]),

            settings.historyEnabled
                ? prisma.history.findMany({

                    where: {
                        userId
                    },

                    orderBy: {
                        createdAt: "desc"
                    },

                    take: 20,

                    select: {
                        id: true,
                        title: true,
                        type: true,
                        report: true,
                        createdAt: true
                    }

                })
                : Promise.resolve([]),

            settings.memoryEnabled
                ? MemoryService.list(userId)
                : Promise.resolve([]),

            prisma.chatMessage.findMany({

                where: {
                    conversationId:
                        conversation.id
                },

                orderBy: {
                    createdAt: "desc"
                },

                take: 30,

                select: {
                    role: true,
                    content: true,
                    createdAt: true
                }

            })

        ]);

        const conversationHistory =
            previousMessages
                .reverse()
                .map(item => ({

                    role: item.role,
                    content: item.content

                }));

        const context = {

            settings: {

                memoryEnabled:
                    settings.memoryEnabled,

                historyEnabled:
                    settings.historyEnabled,

                executiveMode:
                    settings.executiveMode,

                aiModel:
                    settings.aiModel

            },

            memories: memories
                .slice(0, 50)
                .map(memory => ({

                    type: memory.type,
                    title: memory.title,
                    content: memory.content,
                    source: memory.source,
                    importance:
                        memory.importance,
                    tags: memory.tags

                })),

            tasks: tasks
                .slice(0, 30)
                .map(task => ({

                    title: task.title,
                    description:
                        task.description,
                    status: task.status,
                    priority: task.priority,
                    source: task.source,
                    owner: task.owner,
                    dueDate: task.dueDate

                })),

            history: history.map(item => ({

                title: item.title,
                type: item.type,
                createdAt: item.createdAt,
                report: item.report

            })),

            conversation:
                conversationHistory

        };

        const prompt = `
Jesteś PrzemAI.

Odpowiadaj po polsku.

Masz dostęp do danych konkretnego użytkownika.

AKTUALNE USTAWIENIA:

Pamięć AI:
${settings.memoryEnabled ? "WŁĄCZONA" : "WYŁĄCZONA"}

Historia analiz:
${settings.historyEnabled ? "WŁĄCZONA" : "WYŁĄCZONA"}

Tryb Executive:
${settings.executiveMode ? "WŁĄCZONY" : "WYŁĄCZONY"}

Jeżeli Pamięć AI jest włączona,
możesz korzystać z przekazanej pamięci długoterminowej.

Jeżeli Historia analiz jest włączona,
możesz korzystać z historii dokumentów i spotkań.

Jeżeli Tryb Executive jest włączony,
możesz korzystać z zadań i danych biznesowych
oraz działać jako Executive Copilot.

Nie wymyślaj faktów.

Jeżeli dane z różnych źródeł są sprzeczne,
zaznacz to użytkownikowi.

Jeżeli odpowiedzi nie da się ustalić
na podstawie dostępnych danych,
napisz jasno, że odpowiednia informacja
nie została odnaleziona.

KONTEKST UŻYTKOWNIKA:

${JSON.stringify(context, null, 2)}

AKTUALNA WIADOMOŚĆ UŻYTKOWNIKA:

${message}
`;

        const systemPrompt =
            settings.executiveMode
                ? "Jesteś PrzemAI Executive Copilot. Korzystasz z dostępnych danych biznesowych użytkownika. Odpowiadasz konkretnie, profesjonalnie i nie zmyślasz faktów."
                : "Jesteś PrzemAI. Odpowiadasz konkretnie, profesjonalnie i nie zmyślasz faktów.";

        const answer =
            await this.ai.ask({

                system: systemPrompt,

                user: prompt,

                model:
                    settings.aiModel ||
                    "gpt-5.5"

            });

        const assistantMessage =
            await this.createMessage(
                conversation.id,
                "assistant",
                answer
            );

        await prisma.chatConversation.update({

            where: {
                id: conversation.id
            },

            data: {
                lastMessageAt:
                    new Date()
            }

        });

        let savedMemories = [];

        if (settings.memoryEnabled) {

            try {

                const extractedMemories =
                    await this.ai.extractMemories({

                        userMessage:
                            message,

                        assistantMessage:
                            answer

                    });

                savedMemories =
                    await MemoryService
                        .saveExtractedMemories(
                            userId,
                            extractedMemories
                        );

            }
            catch (err) {

                console.error(
                    "Błąd zapisu pamięci AI:",
                    err.message
                );

            }

        }

        return {

            conversationId:
                conversation.id,

            answer,

            message:
                assistantMessage,

            savedMemories,

            settings: {

                memoryEnabled:
                    settings.memoryEnabled,

                historyEnabled:
                    settings.historyEnabled,

                executiveMode:
                    settings.executiveMode,

                aiModel:
                    settings.aiModel

            },

            context

        };

    }

    async getOrCreateConversation(
        userId,
        conversationId,
        firstMessage
    ) {

        if (conversationId) {

            const conversation =
                await prisma.chatConversation
                    .findFirst({

                        where: {
                            id: conversationId,
                            userId,
                            archivedAt: null
                        }

                    });

            if (!conversation) {

                throw new Error(
                    "Rozmowa nie istnieje."
                );

            }

            return conversation;

        }

        return prisma.chatConversation.create({

            data: {

                title:
                    this.buildConversationTitle(
                        firstMessage
                    ),

                userId

            }

        });

    }

    async createMessage(
        conversationId,
        role,
        content
    ) {

        return prisma.chatMessage.create({

            data: {

                conversationId,
                role,
                content

            }

        });

    }

    buildConversationTitle(message) {

        const normalized =
            message
                .replace(/\s+/g, " ")
                .trim();

        if (!normalized) {

            return "Nowa rozmowa";

        }

        if (normalized.length <= 60) {

            return normalized;

        }

        return `${normalized.slice(0, 57)}...`;

    }

    async listConversations(userId) {

        return prisma.chatConversation
            .findMany({

                where: {

                    userId,
                    archivedAt: null

                },

                orderBy: {

                    lastMessageAt: "desc"

                },

                select: {

                    id: true,
                    title: true,
                    lastMessageAt: true,
                    createdAt: true,
                    updatedAt: true,

                    _count: {

                        select: {

                            messages: true

                        }

                    }

                }

            });

    }

    async getConversation(
        userId,
        conversationId
    ) {

        return prisma.chatConversation
            .findFirst({

                where: {

                    id: conversationId,
                    userId,
                    archivedAt: null

                },

                include: {

                    messages: {

                        orderBy: {

                            createdAt: "asc"

                        }

                    }

                }

            });

    }

    async archiveConversation(
        userId,
        conversationId
    ) {

        const conversation =
            await prisma.chatConversation
                .findFirst({

                    where: {

                        id: conversationId,
                        userId,
                        archivedAt: null

                    }

                });

        if (!conversation) {

            throw new Error(
                "Rozmowa nie istnieje."
            );

        }

        return prisma.chatConversation
            .update({

                where: {

                    id: conversationId

                },

                data: {

                    archivedAt:
                        new Date()

                }

            });

    }

}

module.exports = new ChatService();