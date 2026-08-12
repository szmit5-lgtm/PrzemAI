const express = require("express");

const DocumentController = require("../controllers/DocumentController");
const verifyToken = require("../middleware/verifyToken");

const upload = require("../middleware/upload");

const router = express.Router();

const controller = new DocumentController();

router.post(
    "/",
    verifyToken,
    upload.single("file"),
    (req, res) => controller.analyze(req, res)
);

module.exports = router;