const MeetingAgent = require("../../../agents/meeting/MeetingAgent");
const SpeechToText = require("../../../core/audio/SpeechToText");

class VoiceHandler {

    constructor(bot, fileService) {

        this.bot = bot;

        this.fileService = fileService;

        this.speech = new SpeechToText();

        this.meeting = new MeetingAgent();

    }

    async handle(chatId, voice) {

        await this.bot.sendMessage(
            chatId,
            "🎤 Otrzymałem nagranie.\n\n⬇️ Pobieram..."
        );

        const filePath =
            await this.fileService.download(voice.file_id);

        await this.bot.sendMessage(
            chatId,
            "🧠 Transkrybuję nagranie..."
        );

        const transcript =
            await this.speech.transcribe(filePath);

        await this.bot.sendMessage(
            chatId,
            "🤖 Analizuję spotkanie..."
        );

        const summary =
            await this.meeting.process(transcript);

        const MAX = 4000;

        for (let i = 0; i < summary.length; i += MAX) {

            await this.bot.sendMessage(
                chatId,
                summary.substring(i, i + MAX)
            );

        }

    }

}

module.exports = VoiceHandler;