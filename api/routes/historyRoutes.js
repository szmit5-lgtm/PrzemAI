const express = require("express");

const HistoryController = require("../controllers/HistoryController");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

const controller = new HistoryController();

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

router.delete(
    "/:id",
    verifyToken,
    (req, res) => controller.remove(req, res)
);

module.exports = router;