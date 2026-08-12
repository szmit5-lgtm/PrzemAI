const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const MemoryController = require("../controllers/MemoryController");

const router = express.Router();

router.get(
    "/",
    verifyToken,
    (req, res) => MemoryController.list(req, res)
);

router.get(
    "/:id",
    verifyToken,
    (req, res) => MemoryController.get(req, res)
);

router.post(
    "/",
    verifyToken,
    (req, res) => MemoryController.create(req, res)
);

router.put(
    "/:id",
    verifyToken,
    (req, res) => MemoryController.update(req, res)
);

router.delete(
    "/:id",
    verifyToken,
    (req, res) => MemoryController.archive(req, res)
);

module.exports = router;