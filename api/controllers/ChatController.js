const ChatService = require("../services/ChatService");

class ChatController {

    async chat(req, res) {

        try {

            const {
                message,
                conversationId
            } = req.body;

            if (!message || !message.trim()) {

                return res.status(400).json({

                    success: false,

                    error: "Brak wiadomości."

                });

            }

            const result = await ChatService.chat(

                req.user.id,
                message,
                conversationId || null

            );

            return res.json({

                success: true,

                conversationId: result.conversationId,

                answer: result.answer,

                message: result.message

            });

        }
        catch (err) {

            console.error(err);

            return res.status(500).json({

                success: false,

                error: err.message

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

            console.error(err);

            return res.status(500).json({

                success: false,

                error: err.message

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

            return res.json({

                success: true,

                conversation

            });

        }
        catch (err) {

            console.error(err);

            return res.status(500).json({

                success: false,

                error: err.message

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

            console.error(err);

            return res.status(500).json({

                success: false,

                error: err.message

            });

        }

    }

}

module.exports = ChatController;