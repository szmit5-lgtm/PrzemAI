const MeetingAgent = require("../../../agents/meeting/MeetingAgent");
const SpeechToText = require("../../../core/audio/SpeechToText");

class MediaHandler {

    constructor(bot, fileService) {

        this.bot = bot;
        this.fileService = fileService;

        this.speech = new SpeechToText();
        this.meetingAgent = new MeetingAgent();

    }

    async handle(chatId, file, folder = "audio") {

        await this.bot.sendMessage(
            chatId,
            "🎙️ Otrzymałem nagranie.\n\n⬇️ Pobieram plik..."
        );

        const filePath = await this.fileService.download(
            file.file_id,
            folder
        );

        await this.bot.sendMessage(
            chatId,
            "📝 Trwa transkrypcja nagrania...\n\nTo może potrwać kilka minut."
        );

        const transcript = await this.speech.transcribe(filePath);

        await this.bot.sendMessage(
            chatId,
            "🤖 Analizuję spotkanie..."
        );

        const answer = await this.meetingAgent.process(transcript);

        const MAX = 4000;

        for (let i = 0; i < answer.length; i += MAX) {

            await this.bot.sendMessage(
                chatId,
                answer.substring(i, i + MAX)
            );

        }

    }

}

module.exports = MediaHandler;