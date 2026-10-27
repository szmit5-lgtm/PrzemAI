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
                error: error.message
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
                error: error.message
            });
        }
    }
}

module.exports = FinanceController;
