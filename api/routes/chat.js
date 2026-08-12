const express = require("express");

module.exports = (controller) => {

    const router = express.Router();

    router.post("/", controller.chat.bind(controller));

    return router;

};