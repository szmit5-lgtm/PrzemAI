const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const ExecutiveService = require("../services/ExecutiveService");

const router = express.Router();

router.get(
    "/dashboard",
    verifyToken,
    async (req, res) => {

        try {

            const dashboard = await ExecutiveService.getDashboard(

                req.user.id

            );

            return res.json({

                success: true,

                dashboard

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,

                error: err.message

            });

        }

    }
);

module.exports = router;