const express = require("express");

const AuthController = require("../controllers/AuthController");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

const controller = new AuthController();

router.post(
    "/login",
    (req, res) => controller.login(req, res)
);

router.get(
    "/me",
    verifyToken,
    (req, res) => controller.me(req, res)
);

router.put(
    "/password",
    verifyToken,
    (req, res) => controller.changePassword(req, res)
);

module.exports = router;