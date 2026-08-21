const fs = require("fs");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const uploadDirectory = path.join(
    process.cwd(),
    "uploads"
);

/*
 * Railway / Docker może uruchomić aplikację
 * bez istniejącego katalogu uploads.
 * Tworzymy go automatycznie.
 */
fs.mkdirSync(uploadDirectory, {
    recursive: true
});

const storage = multer.diskStorage({

    destination(req, file, cb) {

        cb(null, uploadDirectory);

    },

    filename(req, file, cb) {

        const ext =
            path.extname(file.originalname).toLowerCase();

        cb(
            null,
            crypto.randomBytes(16).toString("hex") + ext
        );

    }

});

const allowedExtensions = [

    // Dokumenty
    ".pdf",
    ".docx",
    ".txt",

    // Audio
    ".mp3",
    ".wav",
    ".m4a",
    ".ogg",
    ".mpeg",
    ".mpga",
    ".flac",

    // Audio / video
    ".webm",
    ".mp4"

];

const upload = multer({

    storage,

    fileFilter(req, file, cb) {

        const ext =
            path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(ext)) {

            return cb(
                new Error(
                    `Nieobsługiwany typ pliku: ${ext}`
                )
            );

        }

        cb(null, true);

    },

    limits: {

        fileSize: 500 * 1024 * 1024

    }

});

module.exports = upload;