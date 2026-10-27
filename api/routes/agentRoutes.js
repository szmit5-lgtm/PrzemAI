const express = require("express");
const AgentController = require("../controllers/AgentController");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();
const controller = new AgentController();

router.get("/", verifyToken, (req, res) => controller.list(req, res));
router.post("/:id/run", verifyToken, (req, res) => controller.runNow(req, res));
router.patch("/:id/enabled", verifyToken, (req, res) =>
  controller.setEnabled(req, res)
);

module.exports = router;
