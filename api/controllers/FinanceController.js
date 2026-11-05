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
