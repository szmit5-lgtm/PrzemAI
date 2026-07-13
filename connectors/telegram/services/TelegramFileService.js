require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

class TelegramFileService {

    constructor(bot) {
        this.bot = bot;
    }

   async download(fileId, folder = "audio") {

        const file = await this.bot.getFile(fileId);

        const url =
            `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;

      const downloadDir = path.join(
    process.cwd(),
    "downloads",
    folder
);

        // Utwórz katalog, jeśli nie istnieje
        fs.mkdirSync(downloadDir, { recursive: true });

        const fileName = path.basename(file.file_path);

        const savePath = path.join(downloadDir, fileName);

        const response = await axios({
            url,
            method: "GET",
            responseType: "stream"
        });

        return new Promise((resolve, reject) => {

            const writer = fs.createWriteStream(savePath);

            response.data.pipe(writer);

            writer.on("finish", () => resolve(savePath));

            writer.on("error", reject);

        });

    }

}

module.exports = TelegramFileService;