const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const storage = multer.diskStorage({

    destination(req, file, cb) {

        cb(null, "uploads");

    },

    filename(req, file, cb) {

        const ext = path.extname(file.originalname);

        cb(
            null,
            crypto.randomBytes(16).toString("hex") + ext
        );

    }

});

const allowed = [

    ".pdf",
    ".docx",
    ".txt"

];

const upload = multer({

    storage,

    fileFilter(req, file, cb) {

        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowed.includes(ext)) {

            return cb(new Error("Nieobsługiwany typ pliku."));

        }

        cb(null, true);

    },

    limits: {

        fileSize: 20 * 1024 * 1024

    }

});

module.exports = upload;