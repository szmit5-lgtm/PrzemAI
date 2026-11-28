const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const ExecutiveService = require("../services/ExecutiveService");

const { getDashboardOverview } = require("../services/DashboardOverviewService");

const router = express.Router();

router.get("/overview", verifyToken, async (req, res) => {
    try {
        const dashboard = await getDashboardOverview(req.user.id);
        return res.json({ success: true, dashboard });
    } catch (error) {
        console.error("[Dashboard] Overview failed", error?.name, error?.code);
        return res.status(500).json({ success: false, error: "Nie udało się pobrać podsumowania zadań." });
    }
});

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