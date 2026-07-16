require("dotenv").config();

const TelegramBot =
    require("node-telegram-bot-api").default ||
    require("node-telegram-bot-api");

const Logger = require("../../core/logger/logger");
const TelegramFileService = require("./services/TelegramFileService");

// Handlery
const VoiceHandler = require("./handlers/VoiceHandler");
const DocumentHandler = require("./handlers/DocumentHandler");
const TextHandler = require("./handlers/TextHandler");

class PrzemAIBot {

    constructor() {

        this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
            polling: true
        });

        this.logger = new Logger();

        this.fileService = new TelegramFileService(this.bot);

        this.voiceHandler = new VoiceHandler(
            this.bot,
            this.fileService
        );

        this.documentHandler = new DocumentHandler(
            this.bot,
            this.fileService
        );

        this.textHandler = new TextHandler(
            this.bot
        );

    }

    start() {

        console.log("🤖 PrzemAI Telegram uruchomiony");

        this.bot.on("message", async (msg) => {

            const chatId = msg.chat.id;

            try {

                // ==========================
                // GŁOS
                // ==========================

                if (msg.voice) {

                    await this.voiceHandler.handle(
                        chatId,
                        msg.voice
                    );

                    return;

                }

                // ==========================
                // DOKUMENT
                // ==========================

                if (msg.document) {

                    await this.documentHandler.handle(
                        chatId,
                        msg.document
                    );

                    return;

                }

                // ==========================
                // TEKST
                // ==========================

                if (msg.text) {

                    await this.textHandler.handle(
                        chatId,
                        msg.text
                    );

                    return;

                }

            } catch (err) {

                console.error(err);

                this.logger.error(err.stack || err.message);

                await this.bot.sendMessage(
                    chatId,
                    "❌ Wystąpił błąd.\n\n" + err.message
                );

            }

        });

    }

}

module.exports = PrzemAIBot;