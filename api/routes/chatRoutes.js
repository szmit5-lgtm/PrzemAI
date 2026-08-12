const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const ChatController = require("../controllers/ChatController");

const router = express.Router();

const controller = new ChatController();

router.get(
    "/",
    verifyToken,
    (req, res) => controller.list(req, res)
);

router.get(
    "/:id",
    verifyToken,
    (req, res) => controller.get(req, res)
);

router.post(
    "/",
    verifyToken,
    (req, res) => controller.chat(req, res)
);

router.delete(
    "/:id",
    verifyToken,
    (req, res) => controller.remove(req, res)
);

module.exports = router;