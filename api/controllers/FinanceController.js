const FinanceService = require("../services/FinanceService");

class FinanceController {
    constructor() {
        this.service = new FinanceService();
    }

    async list(req, res) {
        try {
            const items =
                await this.service.list(
                    req.user.id,
                    req.query
                );

            res.json({
                success: true,
                items
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Nie udało się pobrać danych finansowych."
            });
        }
    }

    async one(req, res) {
        try {
            const item = await this.service.one(req.user.id, req.params.id);
            if (!item) return res.status(404).json({ success: false, error: "Dokument nie istnieje." });
            return res.json({ success: true, item });
        } catch {
            return res.status(500).json({ success: false, error: "Nie udało się pobrać faktury." });
        }
    }

    async queueKsefBackfill(req, res) {
        try {
            const result = await this.service.queueKsefBackfill(req.user.id);
            return res.status(result.queued ? 202 : 200).json({
                success: true, data: result
            });
        } catch (error) {
            if (error?.message === "Integracja KSeF nie jest aktywna na tym koncie." ||
                error?.message === "Włącz najpierw Financial Agent.") {
                return res.status(403).json({ success: false, error: error.message });
            }
            return res.status(500).json({
                success: false, error: "Nie udało się zlecić importu historycznego."
            });
        }
    }

    async projects(req, res) {
        try {
            return res.json({ success: true, items: await this.service.listProjects(req.user.id) });
        } catch {
            return res.status(500).json({ success: false, error: "Nie udało się pobrać projektów." });
        }
    }

    async createProject(req, res) {
        try {
            const item = await this.service.createProject(req.user.id, req.body || {});
            return res.status(201).json({ success: true, item });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message || "Nie udało się utworzyć projektu."
            });
        }
    }

    async assignProject(req, res) {
        try {
            const { projectId } = req.body || {};
            if (projectId === undefined) return res.status(400).json({
                success: false, error: "Podaj projekt lub null."
            });
            const data = await this.service.assignProject(req.user.id, req.params.id, projectId);
            if (!data) return res.status(404).json({ success: false, error: "Dokument nie istnieje." });
            return res.json({ success: true, data });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message || "Nie można przypisać projektu."
            });
        }
    }

    async summary(req, res) {
        try {
            const data =
                await this.service.summary(
                    req.user.id
                );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Nie udało się pobrać danych finansowych."
            });
        }
    }
}

module.exports = FinanceController;
