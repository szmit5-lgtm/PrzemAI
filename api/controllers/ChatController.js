const ChatService = require("../services/ChatService");

class ChatController {

    async chat(req, res) {

        try {

            const {
                message,
                conversationId,
                organizationId,
                requestId,
                background
            } = req.body || {};

            if (typeof message !== "string" || !message.trim()) {

                return res.status(400).json({

                    success: false,

                    error: "Brak wiadomości."

                });

            }

            if (message.length > 12000) {
                return res.status(413).json({
                    success: false,
                    error: "Wiadomość jest zbyt długa (maksymalnie 12 000 znaków)."
                });
            }

            if (conversationId != null &&
                (typeof conversationId !== "string" || conversationId.length > 128)) {
                return res.status(400).json({
                    success: false,
                    error: "Nieprawidłowy identyfikator rozmowy."
                });
            }

            if (organizationId != null &&
                (typeof organizationId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(organizationId))) {
                return res.status(400).json({ success: false, error: "Nieprawidłowy identyfikator spółki." });
            }

            if (requestId != null &&
                (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId))) {
                return res.status(400).json({ success: false, error: "Nieprawidłowy identyfikator żądania." });
            }

            const result = await ChatService.chat(

                req.user.id,
                message,
                conversationId || null,
                { organizationId: organizationId || null, requestId: requestId || null, ...(background === true && { background }) }

            );

            res.set("Cache-Control", "private, no-store");
            return res.json({

                success: true,

                conversationId: result.conversationId,

                answer: result.answer,

                message: result.message,
                ...(result.pending && { pending: true })

            });

        }
        catch (err) {

            const status = { GENERAL_RATE_LIMIT: 429, CHAT_REQUEST_CONFLICT: 409 }[err?.code];
            if (err?.status === 403) return res.status(403).json({ success: false, error: "Brak dostępu do spółki." });
            if (status) return res.status(status).json({ success: false, error: err.message });
            console.error("[ChatController]", err?.name || "Error");

            return res.status(500).json({

                success: false,

                error: "Nie udało się wykonać operacji na rozmowie."

            });

        }

    }

    async list(req, res) {

        try {

            const conversations =
                await ChatService.listConversations(

                    req.user.id

                );

            return res.json({

                success: true,

                conversations

            });

        }
        catch (err) {

            console.error("[ChatController]", err?.name || "Error");

            return res.status(500).json({

                success: false,

                error: "Nie udało się wykonać operacji na rozmowie."

            });

        }

    }

    async get(req, res) {

        try {

            const conversation =
                await ChatService.getConversation(

                    req.user.id,
                    req.params.id

                );

            if (!conversation) {

                return res.status(404).json({

                    success: false,

                    error: "Rozmowa nie istnieje."

                });

            }

            res.set("Cache-Control", "private, no-store");
            return res.json({

                success: true,

                conversation

            });

        }
        catch (err) {

            console.error("[ChatController]", err?.name || "Error");

            return res.status(500).json({

                success: false,

                error: "Nie udało się wykonać operacji na rozmowie."

            });

        }

    }

    async remove(req, res) {

        try {

            await ChatService.archiveConversation(

                req.user.id,
                req.params.id

            );

            return res.json({

                success: true,

                message: "Rozmowa została zarchiwizowana."

            });

        }
        catch (err) {

            console.error("[ChatController]", err?.name || "Error");

            return res.status(500).json({

                success: false,

                error: "Nie udało się wykonać operacji na rozmowie."

            });

        }

    }

}

module.exports = ChatController;