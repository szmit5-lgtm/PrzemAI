require("dotenv").config();

const TelegramBot =
    require("node-telegram-bot-api").default ||
    require("node-telegram-bot-api");

const ExecutiveAgent = require("../../agents/executive/ExecutiveAgent");
const MeetingAgent = require("../../agents/meeting/MeetingAgent");
const DocumentAgent = require("../../agents/document/DocumentAgent");

const Logger = require("../../core/logger/logger");
const TelegramFileService = require("./services/TelegramFileService");
const SpeechToText = require("../../core/audio/SpeechToText");
const DocumentEngine = require("../../core/document/DocumentEngine");

class PrzemAIBot {

    constructor() {

        this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
            polling: true
        });

        this.executive = new ExecutiveAgent();
        this.meeting = new MeetingAgent();
        this.documentAgent = new DocumentAgent();

        this.logger = new Logger();

        this.fileService = new TelegramFileService(this.bot);

        this.speech = new SpeechToText();
        this.document = new DocumentEngine();

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

                    await this.bot.sendMessage(
                        chatId,
                        "📄 Otrzymałem dokument.\n\n⬇️ Pobieram..."
                    );

                    const filePath =
                        await this.fileService.download(
                            msg.document.file_id,
                            "documents"
                        );

                    await this.bot.sendMessage(
                        chatId,
                        "📖 Odczytuję dokument..."
                    );

                    const text =
                        await this.document.extractText(filePath);

                    await this.bot.sendMessage(
                        chatId,
                        "🤖 Analizuję dokument..."
                    );

                    const answer =
                        await this.documentAgent.process(text);

                    const MAX = 4000;

                    for (let i = 0; i < answer.length; i += MAX) {

                        await this.bot.sendMessage(
                            chatId,
                            answer.substring(i, i + MAX)
                        );

                    }

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