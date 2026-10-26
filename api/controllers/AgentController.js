const AgentService = require("../services/AgentService");

class AgentController {
    constructor() {
        this.service = new AgentService();
    }

    async list(req, res) {
        try {
            const data = await this.service.list(req.user.id);

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

    async runNow(req, res) {
        try {
            const data = await this.service.runNow(
                req.user.id,
                req.params.id
            );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async setEnabled(req, res) {
        try {
            const data = await this.service.setEnabled(
                req.user.id,
                req.params.id,
                req.body.enabled
            );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async integrations(req, res) {
        try {
            const data = await this.service.listIntegrations(req.user.id);

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

    async enableDekonicaMail(req, res) {
        try {
            const data = await this.service.enableDekonicaMail(
                req.user.id,
                req.body.enabled
            );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = AgentController;
