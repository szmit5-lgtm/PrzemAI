const SettingsService = require("../services/SettingsService");

class SettingsController {

    async get(req, res) {

        try {

            const settings =
                await SettingsService.get(
                    req.user.id
                );

            res.json({
                success: true,
                settings
            });

        }
        catch (err) {

            res.status(500).json({
                success: false,
                error:
                    err.message ||
                    "Nie udało się pobrać ustawień."
            });

        }

    }

    async update(req, res) {

        try {

            const settings =
                await SettingsService.update(
                    req.user.id,
                    req.body
                );

            res.json({
                success: true,
                settings
            });

        }
        catch (err) {

            res.status(400).json({
                success: false,
                error:
                    err.message ||
                    "Nie udało się zapisać ustawień."
            });

        }

    }

}

module.exports = new SettingsController();