require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api").default || require("node-telegram-bot-api");

const ExecutiveAgent = require("../../agents/executive/ExecutiveAgent");
const Logger = require("../../core/logger/logger");
const TelegramFileService = require("./services/TelegramFileService");

class PrzemAIBot {

    constructor() {

        this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
            polling: true
        });

        this.executive = new ExecutiveAgent();

        this.logger = new Logger();

        this.fileService = new TelegramFileService(this.bot);

    }

    start() {

        console.log("🤖 PrzemAI Telegram uruchomiony");

        this.bot.on("message", async (msg) => {

            const chatId = msg.chat.id;

            try {

                // ===========================
                // OBSŁUGA WIADOMOŚCI GŁOSOWYCH
                // ===========================

                if (msg.voice) {

                    await this.bot.sendMessage(
                        chatId,
                        "🎤 Otrzymałem nagranie. Pobieram plik..."
                    );

                    const filePath = await this.fileService.download(
                        msg.voice.file_id
                    );

                    this.logger.info("Voice saved: " + filePath);

                    await this.bot.sendMessage(
                        chatId,
                        "✅ Nagranie zapisane.\n\n" + filePath
                    );

                    return;

                }

                // ===========================
                // OBSŁUGA WIADOMOŚCI TEKSTOWYCH
                // ===========================

                const text = msg.text;

                if (!text) return;

                this.logger.info("Telegram: " + text);

                const answer = await this.executive.process(text);

                await this.bot.sendMessage(chatId, answer);

            } catch (err) {

                console.error(err);

                this.logger.error(err.message);

                await this.bot.sendMessage(
                    chatId,
                    "❌ Wystąpił błąd podczas przetwarzania wiadomości."
                );

            }

        });

    }

}

module.exports = PrzemAIBot;