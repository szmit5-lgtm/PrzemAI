require("dotenv").config();

const TelegramBot =
    require("node-telegram-bot-api").default ||
    require("node-telegram-bot-api");

const ExecutiveAgent = require("../../agents/executive/ExecutiveAgent");
const MeetingAgent = require("../../agents/meeting/MeetingAgent");

const Logger = require("../../core/logger/logger");
const TelegramFileService = require("./services/TelegramFileService");
const SpeechToText = require("../../core/audio/SpeechToText");

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

    }

    start() {

        console.log("🤖 PrzemAI Telegram uruchomiony");

        this.bot.on("message", async (msg) => {

            const chatId = msg.chat.id;

            try {

                // ==========================================
                // OBSŁUGA WIADOMOŚCI GŁOSOWYCH
                // ==========================================

                if (msg.voice) {

                    await this.bot.sendMessage(
                        chatId,
                        "🎤 Otrzymałem nagranie.\n\n⬇️ Pobieram..."
                    );

                    const filePath = await this.fileService.download(
                        msg.voice.file_id
                    );

                    this.logger.info("Voice saved: " + filePath);

                    await this.bot.sendMessage(
                        chatId,
                        "🧠 Transkrybuję nagranie..."
                    );

                    const transcript =
                        await this.speech.transcribe(filePath);

                    this.logger.info("Transcript created.");

                    await this.bot.sendMessage(
                        chatId,
                        "🤖 Analizuję spotkanie..."
                    );

                    const summary =
                        await this.meeting.process(transcript);

                    await this.bot.sendMessage(chatId, summary);

                    return;

                }

                // ==========================================
                // OBSŁUGA WIADOMOŚCI TEKSTOWYCH
                // ==========================================

                if (!msg.text) return;

                this.logger.info("Telegram: " + msg.text);

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