require("dotenv").config();

const TelegramBot =
    require("node-telegram-bot-api").default ||
    require("node-telegram-bot-api");

const ExecutiveAgent = require("../../agents/executive/ExecutiveAgent");

const Logger = require("../../core/logger/logger");
const TelegramFileService = require("./services/TelegramFileService");

// Handlery
const DocumentHandler = require("./handlers/DocumentHandler");
const VoiceHandler = require("./handlers/VoiceHandler");

class PrzemAIBot {

    constructor() {

        this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
            polling: true
        });

        this.executive = new ExecutiveAgent();

        this.logger = new Logger();

        this.fileService = new TelegramFileService(this.bot);

        this.documentHandler = new DocumentHandler(
            this.bot,
            this.fileService
        );

        this.voiceHandler = new VoiceHandler(
            this.bot,
            this.fileService
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

                if (!msg.text) return;

                const answer =
                    await this.executive.process(msg.text);

                await this.bot.sendMessage(chatId, answer);

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