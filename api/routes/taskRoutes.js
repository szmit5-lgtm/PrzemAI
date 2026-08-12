const express = require("express");

const TaskController = require("../controllers/TaskController");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

const controller = new TaskController();

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
    (req, res) => controller.create(req, res)
);

router.put(
    "/:id",
    verifyToken,
    (req, res) => controller.update(req, res)
);

router.patch(
    "/:id/complete",
    verifyToken,
    (req, res) => controller.complete(req, res)
);

router.delete(
    "/:id",
    verifyToken,
    (req, res) => controller.remove(req, res)
);

module.exports = router;