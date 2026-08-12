const express = require("express");
const multer = require("multer");

module.exports = (meetingController) => {

    const router = express.Router();

    const upload = multer({

        dest: "uploads/"

    });

    router.get("/", (req, res) => {

        res.json({

            success: true,
            message: "Meeting API działa"

        });

    });

    router.post(

        "/",
        upload.single("file"),
        (req, res) => meetingController.analyze(req, res)

    );

    return router;

};