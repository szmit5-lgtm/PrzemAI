const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const ExecutiveService = require("../services/ExecutiveService");

const { getDashboardOverview } = require("../services/DashboardOverviewService");

const { OwnerBriefingService } = require("../services/OwnerBriefingService");
const briefing = new OwnerBriefingService();
const router = express.Router();

router.get("/owner-briefing", verifyToken, async (req, res) => {
    try {
        return res.json({ success: true, data: await briefing.read(req.user.id) });
    } catch (error) {
        console.error("[Owner briefing] Read failed", error?.name, error?.code);
        return res.status(503).json({ success: false, error: "Raport właściciela jest chwilowo niedostępny." });
    }
});

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