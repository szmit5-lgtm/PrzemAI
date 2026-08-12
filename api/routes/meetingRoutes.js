const express = require("express");

const MeetingController = require("../controllers/MeetingController");
const verifyToken = require("../middleware/verifyToken");

const upload = require("../middleware/upload");

const router = express.Router();

const controller = new MeetingController();

router.post(
    "/",
    verifyToken,
    upload.single("file"),
    (req, res) => controller.analyze(req, res)
);

module.exports = router;