require("dotenv").config();

const TelegramBot =
    require("node-telegram-bot-api").default ||
    require("node-telegram-bot-api");

const ExecutiveAgent = require("../../agents/executive/ExecutiveAgent");
const MeetingAgent = require("../../agents/meeting/MeetingAgent");

const Logger = require("../../core/logger/logger");
const TelegramFileService = require("./services/TelegramFileService");
const SpeechToText = require("../../core/audio/SpeechToText");

// NOWY HANDLER
const DocumentHandler = require("./handlers/DocumentHandler");

class PrzemAIBot {

    constructor() {

        this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
            polling: true
        });

        this.executive = new ExecutiveAgent();
        this.meeting = new MeetingAgent();

        this.logger = new Logger();

        this.fileService = new TelegramFileService(this.bot);

        this.speech = new SpeechToText();

        // NOWY HANDLER
        this.documentHandler = new DocumentHandler(
            this.bot,
            this.fileService
        );

    }

    start() {

        console.log("🤖 PrzemAI Telegram uruchomiony");

        this.bot.on("message", async (msg) => {

            const chatId = msg.chat.id;

            try {

                // ==========================================
                // GŁOS
                // ==========================================

                if (msg.voice) {

                    await this.bot.sendMessage(
                        chatId,
                        "🎤 Otrzymałem nagranie.\n\n⬇️ Pobieram..."
                    );

                    const filePath =
                        await this.fileService.download(msg.voice.file_id);

                    const transcript =
                        await this.speech.transcribe(filePath);

                    const summary =
                        await this.meeting.process(transcript);

                    await this.bot.sendMessage(chatId, summary);

                    return;

                }

                // ==========================================
                // DOKUMENT
                // ==========================================

                if (msg.document) {

                    await this.documentHandler.handle(
                        chatId,
                        msg.document
                    );

                    return;

                }

                // ==========================================
                // TEKST
                // ==========================================

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