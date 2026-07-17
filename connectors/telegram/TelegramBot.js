require("dotenv").config();

const TelegramBot =
    require("node-telegram-bot-api").default ||
    require("node-telegram-bot-api");

const Logger = require("../../core/logger/logger");
const TelegramFileService = require("./services/TelegramFileService");

// Handlery
const MediaHandler = require("./handlers/MediaHandler");
const DocumentHandler = require("./handlers/DocumentHandler");
const TextHandler = require("./handlers/TextHandler");

class PrzemAIBot {

    constructor() {

        this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
            polling: true
        });

        this.logger = new Logger();

        this.fileService = new TelegramFileService(this.bot);

        this.mediaHandler = new MediaHandler(
            this.bot,
            this.fileService
        );

        this.documentHandler = new DocumentHandler(
            this.bot,
            this.fileService,
            this.mediaHandler
        );

        this.textHandler = new TextHandler(
            this.bot
        );

    }

    start() {

        console.log("🤖 PrzemAI Telegram uruchomiony");

        // DEBUG

        this.bot.on("audio", (msg) => {

            console.log("========== AUDIO EVENT ==========");
            console.log(JSON.stringify(msg, null, 2));

        });

        this.bot.on("document", (msg) => {

            console.log("========== DOCUMENT EVENT ==========");
            console.log(JSON.stringify(msg, null, 2));

        });

        this.bot.on("voice", (msg) => {

            console.log("========== VOICE EVENT ==========");
            console.log(JSON.stringify(msg, null, 2));

        });

        this.bot.on("message", async (msg) => {

            console.log("========== MESSAGE EVENT ==========");
            console.log(JSON.stringify(msg, null, 2));

            const chatId = msg.chat.id;

            try {

                if (msg.voice) {

                    console.log("VOICE");

                    await this.mediaHandler.handle(
                        chatId,
                        msg.voice
                    );

                    return;

                }

                if (msg.audio) {

                    console.log("AUDIO");

                    await this.mediaHandler.handle(
                        chatId,
                        msg.audio
                    );

                    return;

                }

                if (msg.document) {

                    console.log("DOCUMENT");

                    await this.documentHandler.handle(
                        chatId,
                        msg.document
                    );

                    return;

                }

                if (msg.text) {

                    console.log("TEXT");

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