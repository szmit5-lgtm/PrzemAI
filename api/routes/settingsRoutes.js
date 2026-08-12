const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const SettingsController = require("../controllers/SettingsController");

const router = express.Router();

router.get(
    "/",
    verifyToken,
    (req, res) =>
        SettingsController.get(req, res)
);

router.put(
    "/",
    verifyToken,
    (req, res) =>
        SettingsController.update(req, res)
);

module.exports = router;