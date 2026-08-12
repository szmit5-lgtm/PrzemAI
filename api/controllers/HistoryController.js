const HistoryService = require("../services/HistoryService");

class HistoryController {

    async list(req, res) {

        try {

            const items = await HistoryService.list(

                req.user.id

            );

            return res.json({

                success: true,

                items

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,

                error: err.message

            });

        }

    }

    async get(req, res) {

        try {

            const item = await HistoryService.get(

                req.params.id,

                req.user.id

            );

            if (!item) {

                return res.status(404).json({

                    success: false,

                    error: "Analiza nie została znaleziona."

                });

            }

            return res.json({

                success: true,

                item

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,

                error: err.message

            });

        }

    }

    async remove(req, res) {

        try {

            await HistoryService.remove(

                req.params.id,

                req.user.id

            );

            return res.json({

                success: true,

                message: "Analiza została usunięta."

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,

                error: err.message

            });

        }

    }

}

module.exports = HistoryController;