const express = require("express");
const multer = require("multer");

const upload = multer({
    dest: "uploads/"
});

module.exports = (controller) => {

    const router = express.Router();

    router.post(
        "/",
        upload.single("file"),
        controller.analyze.bind(controller)
    );

    return router;

};