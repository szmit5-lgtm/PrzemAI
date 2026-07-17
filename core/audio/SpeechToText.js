require("dotenv").config();

const fs = require("fs");
const path = require("path");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

const OpenAI = require("openai");

ffmpeg.setFfmpegPath(ffmpegPath);

class SpeechToText {

    constructor() {

        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

    }

    convertToMp3(inputFile) {

        return new Promise((resolve, reject) => {

            const ext = path.extname(inputFile).toLowerCase();

            // Jeśli plik jest już MP3, nie konwertujemy
            if (ext === ".mp3") {

                return resolve(inputFile);

            }

            const outputFile = inputFile.replace(ext, ".mp3");

            ffmpeg(inputFile)
                .audioCodec("libmp3lame")
                .format("mp3")
                .save(outputFile)
                .on("end", () => resolve(outputFile))
                .on("error", reject);

        });

    }

    async transcribe(filePath) {

        const mp3 = await this.convertToMp3(filePath);

        const transcription =
            await this.client.audio.transcriptions.create({

                file: fs.createReadStream(mp3),

                model: "gpt-4o-mini-transcribe"

            });

        return transcription.text;

    }

}

module.exports = SpeechToText;