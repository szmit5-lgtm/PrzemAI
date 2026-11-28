const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const ExecutiveService = require("../services/ExecutiveService");

const { getDashboardOverview } = require("../services/DashboardOverviewService");

const { OwnerBriefingService } = require("../services/OwnerBriefingService");
const briefing = new OwnerBriefingService();
const { OwnerDailyBriefingService } = require("../services/OwnerDailyBriefingService");
const daily = new OwnerDailyBriefingService({ briefing });
const { OrganizationError } = require("../services/OrganizationService");
const router = express.Router();

router.get("/owner-briefing", verifyToken, async (req, res) => {
    try {
        const report = await briefing.read(req.user.id);
        return res.json({ success: true, data: await daily.decorate(req.user.id, report) });
    } catch (error) {
        console.error("[Owner briefing] Read failed", error?.name, error?.code);
        return res.status(503).json({ success: false, error: "Raport właściciela jest chwilowo niedostępny." });
    }
});

router.patch("/owner-briefing/alerts", verifyToken, async (req, res) => {
    try {
        const { alertId, status } = req.body || {};
        return res.json({ success: true, data: await briefing.setAlert(req.user.id, alertId, status) });
    } catch (error) {
        if (error instanceof OrganizationError) return res.status(error.status).json({ success: false, error: error.message });
        console.error("[Owner briefing] Alert update failed", error?.name, error?.code);
        return res.status(503).json({ success: false, error: "Nie udało się zapisać stanu alertu." });
    }
});

router.patch("/owner-briefing/schedule", verifyToken, async (req, res) => {
    try {
        return res.json({ success: true, data: await daily.setSchedule(req.user.id, req.body?.time) });
    } catch (error) {
        if (error instanceof OrganizationError) return res.status(error.status).json({ success: false, error: error.message });
        return res.status(503).json({ success: false, error: "Nie udało się zapisać godziny raportu." });
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