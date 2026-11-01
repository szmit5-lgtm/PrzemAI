// Validate chat responses before changing the conversation UI.
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const hasId = value => typeof value === "string" && value.trim().length > 0;

export function parseChatListResponse(response) {
    if (response?.success !== true || !Array.isArray(response.conversations) ||
        !response.conversations.every(item =>
            isRecord(item) && hasId(item.id) &&
            typeof item.title === "string" && item.title.trim().length > 0
        )) {
        throw new Error("Nieprawidłowa odpowiedź listy rozmów.");
    }
    return response.conversations;
}

export function parseChatDetailResponse(response, requestedId) {
    const conversation = response?.conversation;
    if (response?.success !== true || !isRecord(conversation) ||
        !hasId(conversation.id) || conversation.id !== requestedId ||
        !Array.isArray(conversation.messages) ||
        !conversation.messages.every(item =>
            isRecord(item) && hasId(item.id) &&
            (item.role === "user" || item.role === "assistant" || item.role === "system") &&
            typeof item.content === "string"
        )) {
        throw new Error("Nieprawidłowa odpowiedź zapisanej rozmowy.");
    }
    return conversation;
}

export function parseChatSendResponse(response) {
    if (response?.success !== true || !hasId(response.conversationId) ||
        typeof response.answer !== "string" || !response.answer.trim() ||
        !isRecord(response.message) || !hasId(response.message.id) ||
        response.message.role !== "assistant" ||
        response.message.content !== response.answer) {
        throw new Error("Brak potwierdzenia odpowiedzi asystenta.");
    }
    return response;
}

export function parseChatArchiveResponse(response) {
    if (response?.success !== true) {
        throw new Error("Brak potwierdzenia archiwizacji rozmowy.");
    }
    return true;
}
