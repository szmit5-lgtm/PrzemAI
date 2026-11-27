const { createHash } = require("node:crypto");
const prisma = require("../../lib/prisma");
const AIEngine = require("../../core/ai/AIEngine");

const TaskService = require("./TaskService");
const MemoryService = require("./MemoryService");
const SettingsService = require("./SettingsService");
const GeneralAgentService = require("./GeneralAgentService");
const { redactText, documentReport } = require("../../lib/aiContext");

function requestIdentifier(userId, requestId, channel) {
    const scope = channel === "WEB" ? [userId, requestId] : [userId, requestId, channel];
    return createHash("sha256").update(JSON.stringify(scope)).digest("hex");
}

class ChatService {

    constructor() {

        this.ai = new AIEngine();
        this.general = new GeneralAgentService({ ai: this.ai });

    }

    async chat(userId, message, conversationId = null, { organizationId = null, requestId = null, channel = "WEB" } = {}) {

        if (typeof userId !== "string" || !userId) throw new Error("Brak uwierzytelnionego użytkownika.");
        if (typeof message !== "string" || !message.trim() || message.length > 12000)
            throw new Error("Nieprawidłowa wiadomość.");

        const settings = await SettingsService.get(userId);
        const scopedChannel = Boolean(organizationId && channel !== "WEB");

        const requestKey = requestId && GeneralAgentService.accepts(message, organizationId)
            ? requestIdentifier(userId, requestId, channel) : null;
        const title = organizationId ? "Rozmowa firmowa" : message;
        const newConversationId = requestKey && !conversationId ? "general-chat-" + requestKey : null;
        if (newConversationId) {
            await prisma.chatConversation.createMany({
                data: { id: newConversationId, userId, channel, title: this.buildConversationTitle(title) },
                skipDuplicates: true
            });
        }
        const conversation = await this.getOrCreateConversation(userId, conversationId || newConversationId, title, channel);
        const messageScope = organizationId ? { organizationId } : undefined;
        const turnId = requestKey ? "general-turn-" + requestKey : null;
        const turn = await this.createMessage(conversation.id, "user", message, messageScope, turnId);
        if (turn.conversationId !== conversation.id || turn.content !== message ||
            (turn.metadata?.organizationId || null) !== organizationId) {
            throw Object.assign(new Error("Identyfikator żądania należy do innej wiadomości."),
                { code: "CHAT_REQUEST_CONFLICT" });
        }
        const replyId = requestKey ? "general-reply-" + requestKey : null;
        const savedReply = replyId ? await prisma.chatMessage.findUnique({ where: { id: replyId } }) : null;
        if (savedReply) {
            const planId = savedReply.metadata?.generalPlanId;
            const plan = planId ? await this.general.readPlan(
                { userId, conversationId: conversation.id, organizationId },
                planId, { resume: true, historyEnabled: settings.historyEnabled }
            ) : null;
            const answer = plan ? plan.answer + (savedReply.metadata.note || "") : savedReply.content;
            return { conversationId: conversation.id, answer, message: { ...savedReply, content: answer } };
        }

        const delegated = await this.general.handleTurn({
            userId, conversationId: conversation.id, organizationId,
            turnId: turn.id, message, historyEnabled: settings.historyEnabled,
            allowScopedSmallTalk: scopedChannel
        });
        if (delegated) {
            const metadata = delegated.planId
                ? { generalPlanId: delegated.planId, organizationId, note: delegated.note || "" }
                : undefined;
            // Company results are loaded from protected tasks after authorization,
            // never copied into ordinary chat history or long-term memory.
            const reply = await this.createMessage(conversation.id, "assistant",
                metadata ? "Wyniki zleceń General Agenta." : delegated.answer, metadata, replyId);
            await prisma.chatConversation.update({
                where: { id: conversation.id }, data: { lastMessageAt: new Date() }
            });
            return { conversationId: conversation.id, answer: delegated.answer,
                message: { ...reply, content: delegated.answer } };
        }

        const [
            tasks,
            history,
            memories,
            previousMessages
        ] = await Promise.all([

            !scopedChannel && settings.executiveMode
                ? TaskService.list(userId)
                : Promise.resolve([]),

            !scopedChannel && settings.historyEnabled
                ? prisma.history.findMany({

                    where: {
                        userId,
                        type: { in: ["document", "meeting"] }
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

            !scopedChannel && settings.memoryEnabled
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
                    metadata: true,
                    createdAt: true
                }

            })

        ]);

        const conversationHistory =
            previousMessages
                .filter(item => scopedChannel
                    ? item.metadata?.organizationId === organizationId && !item.metadata?.generalPlanId
                    : !item.metadata?.organizationId)
                .reverse()
                .map(item => ({

                    role: item.role,
                    content: redactText(item.content)

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

                    type: redactText(memory.type, 100),
                    title: redactText(memory.title, 200),
                    content: redactText(memory.content, 1600),
                    source: redactText(memory.source, 100),
                    importance:
                        memory.importance,
                    tags: (memory.tags || []).slice(0, 10).map(tag => redactText(tag, 80))

                })),

            tasks: tasks
                .slice(0, 30)
                .map(task => ({

                    title: redactText(task.title, 200),
                    description:
                        redactText(task.description, 1600),
                    status: task.status,
                    priority: task.priority,
                    source: task.source,
                    owner: redactText(task.owner, 120),
                    dueDate: task.dueDate

                })),

            history: history.map(item => ({

                title: redactText(item.title, 200),
                type: item.type,
                createdAt: item.createdAt,
                report: documentReport(item.report)

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

${redactText(message, 12000)}
`;

        const systemPrompt =
            settings.executiveMode
                ? "Jesteś PrzemAI Executive Copilot. Korzystasz z dostępnych danych biznesowych użytkownika. Odpowiadasz konkretnie, profesjonalnie i nie zmyślasz faktów."
                : "Jesteś PrzemAI. Odpowiadasz konkretnie, profesjonalnie i nie zmyślasz faktów.";

        const answer =
            await this.ai.ask({

                system: scopedChannel
                    ? "Jesteś PrzemAI. Odpowiadaj po polsku na podstawie rozmowy. Nie twierdź, że widzisz dane spółki."
                    : systemPrompt,

                user: scopedChannel ? JSON.stringify({
                    conversation: conversationHistory, message: redactText(message, 12000)
                }) : prompt,
                ...(scopedChannel && { maxOutputTokens: 512, requestOptions: { timeout: 15000, maxRetries: 0 } }),

                model:
                    settings.aiModel ||
                    "gpt-5.5"

            });

        const assistantMessage =
            await this.createMessage(
                conversation.id,
                "assistant",
                answer,
                scopedChannel ? messageScope : undefined,
                replyId
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

        if (!scopedChannel && settings.memoryEnabled) {

            try {

                const extractedMemories =
                    await this.ai.extractMemories({

                        userMessage:
                            redactText(message, 12000),

                        assistantMessage:
                            redactText(answer)

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
                    err.name
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
        firstMessage,
        channel = "WEB"
    ) {

        if (conversationId) {

            const conversation =
                await prisma.chatConversation
                    .findFirst({

                        where: {
                            id: conversationId,
                            userId,
                            channel,
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

                channel,
                userId

            }

        });

    }

    async createMessage(conversationId, role, content, metadata, id = null) {
        const data = { conversationId, role, content, ...(metadata && { metadata }) };
        if (!id) return prisma.chatMessage.create({ data });
        await prisma.chatMessage.createMany({ data: { ...data, id }, skipDuplicates: true });
        return prisma.chatMessage.findUnique({ where: { id } });
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
                    channel: "WEB",
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
        conversationId,
        channel = "WEB"
    ) {

        const conversation = await prisma.chatConversation
            .findFirst({

                where: {

                    id: conversationId,
                    userId,
                    channel,
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

        if (!conversation) return null;
        if (!conversation.messages.some(message => message.metadata?.generalPlanId)) return conversation;
        const { historyEnabled } = await SettingsService.get(userId);
        const plans = new Map();
        for (const message of conversation.messages) {
            const metadata = message.metadata;
            if (message.role !== "assistant" || !metadata?.generalPlanId) continue;
            const { generalPlanId, organizationId } = metadata;
            if (!plans.has(generalPlanId)) {
                plans.set(generalPlanId, await this.general.readPlan(
                    { userId, conversationId, organizationId }, generalPlanId, { historyEnabled }
                ));
            }
            message.content = plans.get(generalPlanId).answer + (metadata.note || "");
        }
        return conversation;

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
                        channel: "WEB",
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