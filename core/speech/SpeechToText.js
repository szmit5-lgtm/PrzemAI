const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const OpenAI = require("openai");
const ffmpegPath = require("ffmpeg-static");

class SpeechToText {

    constructor() {

        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        /*
         * Jeżeli plik jest mniejszy niż ten limit,
         * wysyłamy go bez dzielenia.
         */
        this.directUploadLimit =
            20 * 1024 * 1024;

        /*
         * Duże pliki dzielimy na fragmenty
         * po 20 minut.
         */
        this.chunkDurationSeconds =
            20 * 60;

    }

    async transcribe(filePath) {

        if (!fs.existsSync(filePath)) {

            throw new Error(
                "Plik nagrania nie istnieje."
            );

        }

        try {

            const stats =
                fs.statSync(filePath);

            console.log(
                `Nagranie: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
            );

            /*
             * Małe nagranie
             */
            if (
                stats.size <=
                this.directUploadLimit
            ) {

                console.log(
                    "Transkrypcja bez dzielenia."
                );

                return await this.transcribeSingleFile(
                    filePath
                );

            }

            /*
             * Duże nagranie
             */
            console.log(
                "Duży plik. Rozpoczynam dzielenie nagrania..."
            );

            return await this.transcribeLargeFile(
                filePath
            );

        }
        finally {

            /*
             * Oryginalny upload usuwamy niezależnie
             * od wyniku transkrypcji.
             */
            this.safeDelete(filePath);

        }

    }

    async transcribeSingleFile(filePath) {

        const transcript =
            await this.client.audio.transcriptions.create({

                file:
                    fs.createReadStream(filePath),

                model:
                    process.env.TRANSCRIPTION_MODEL ||
                    "gpt-4o-mini-transcribe",

                language: "pl"

            });

        return transcript?.text?.trim() || "";

    }

    async transcribeLargeFile(filePath) {

        const chunkDirectory =
            path.join(
                path.dirname(filePath),
                `chunks-${crypto.randomBytes(8).toString("hex")}`
            );

        fs.mkdirSync(
            chunkDirectory,
            {
                recursive: true
            }
        );

        try {

            await this.splitAudio(
                filePath,
                chunkDirectory
            );

            const chunks =
                fs.readdirSync(chunkDirectory)
                    .filter((file) =>
                        file.toLowerCase().endsWith(".mp3")
                    )
                    .sort()
                    .map((file) =>
                        path.join(
                            chunkDirectory,
                            file
                        )
                    );

            if (!chunks.length) {

                throw new Error(
                    "Nie udało się podzielić nagrania na części."
                );

            }

            console.log(
                `Liczba fragmentów: ${chunks.length}`
            );

            const transcripts = [];

            for (
                let index = 0;
                index < chunks.length;
                index++
            ) {

                const chunk =
                    chunks[index];

                const stats =
                    fs.statSync(chunk);

                console.log(
                    `Transkrypcja fragmentu ${index + 1}/${chunks.length} ` +
                    `(${(stats.size / 1024 / 1024).toFixed(2)} MB)`
                );

                const text =
                    await this.transcribeSingleFile(
                        chunk
                    );

                if (text) {

                    transcripts.push(
                        `[Fragment ${index + 1}]\n${text}`
                    );

                }

            }

            if (!transcripts.length) {

                throw new Error(
                    "Nie udało się utworzyć transkrypcji nagrania."
                );

            }

            return transcripts.join("\n\n");

        }
        finally {

            this.removeDirectory(
                chunkDirectory
            );

        }

    }

    splitAudio(
        inputPath,
        outputDirectory
    ) {

        return new Promise(
            (resolve, reject) => {

                if (!ffmpegPath) {

                    return reject(
                        new Error(
                            "Nie znaleziono FFmpeg."
                        )
                    );

                }

                const outputPattern =
                    path.join(
                        outputDirectory,
                        "chunk-%03d.mp3"
                    );

                /*
                 * Konwertujemy nagranie:
                 *
                 * - bez obrazu,
                 * - mono,
                 * - 16 kHz,
                 * - 32 kbps,
                 * - MP3,
                 * - fragmenty po 20 minut.
                 *
                 * Dzięki temu nawet duże źródłowe pliki
                 * tworzą małe fragmenty do transkrypcji.
                 */
                const args = [

                    "-hide_banner",
                    "-loglevel",
                    "error",

                    "-i",
                    inputPath,

                    "-vn",

                    "-ac",
                    "1",

                    "-ar",
                    "16000",

                    "-b:a",
                    "32k",

                    "-f",
                    "segment",

                    "-segment_time",
                    String(
                        this.chunkDurationSeconds
                    ),

                    "-reset_timestamps",
                    "1",

                    outputPattern

                ];

                const process =
                    spawn(
                        ffmpegPath,
                        args,
                        {
                            windowsHide: true
                        }
                    );

                let errorOutput = "";

                process.stderr.on(
                    "data",
                    (data) => {

                        errorOutput +=
                            data.toString();

                    }
                );

                process.on(
                    "error",
                    (error) => {

                        reject(
                            new Error(
                                `Nie udało się uruchomić FFmpeg: ${error.message}`
                            )
                        );

                    }
                );

                process.on(
                    "close",
                    (code) => {

                        if (code === 0) {

                            resolve();

                            return;

                        }

                        reject(
                            new Error(
                                `FFmpeg zakończył pracę z błędem: ${errorOutput || code}`
                            )
                        );

                    }
                );

            }
        );

    }

    safeDelete(filePath) {

        try {

            if (
                filePath &&
                fs.existsSync(filePath)
            ) {

                fs.unlinkSync(filePath);

            }

        }
        catch (error) {

            console.error(
                "Nie udało się usunąć pliku:",
                filePath,
                error.message
            );

        }

    }

    removeDirectory(directoryPath) {

        try {

            if (
                directoryPath &&
                fs.existsSync(directoryPath)
            ) {

                fs.rmSync(
                    directoryPath,
                    {
                        recursive: true,
                        force: true
                    }
                );

            }

        }
        catch (error) {

            console.error(
                "Nie udało się usunąć katalogu tymczasowego:",
                error.message
            );

        }

    }

}

module.exports = SpeechToText;