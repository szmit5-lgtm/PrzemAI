const express = require("express");
const FinanceController = require("../controllers/FinanceController");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();
const controller = new FinanceController();

router.get(
    "/documents",
    verifyToken,
    (req, res) =>
        controller.list(req, res)
);

router.get(
    "/summary",
    verifyToken,
    (req, res) =>
        controller.summary(req, res)
);

module.exports = router;
