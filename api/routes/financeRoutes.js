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

router.post("/history/import", verifyToken, (req, res) => controller.queueKsefBackfill(req, res));
router.get("/projects", verifyToken, (req, res) => controller.projects(req, res));
router.post("/projects", verifyToken, (req, res) => controller.createProject(req, res));
router.patch("/documents/:id/project", verifyToken, (req, res) => controller.assignProject(req, res));

router.get(
    "/documents/:id",
    verifyToken,
    (req, res) => controller.one(req, res)
);

router.get(
    "/summary",
    verifyToken,
    (req, res) =>
        controller.summary(req, res)
);

module.exports = router;
