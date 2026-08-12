const MemoryService = require("../services/MemoryService");

class MemoryController {

    async list(req, res) {

        try {

            const memories =
                await MemoryService.list(
                    req.user.id
                );

            res.json({
                success: true,
                memories
            });

        }
        catch (err) {

            res.status(500).json({
                success: false,
                error:
                    err.message ||
                    "Nie udało się pobrać pamięci."
            });

        }

    }

    async get(req, res) {

        try {

            const memory =
                await MemoryService.get(
                    req.user.id,
                    req.params.id
                );

            if (!memory) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Wspomnienie nie istnieje."
                });

            }

            res.json({
                success: true,
                memory
            });

        }
        catch (err) {

            res.status(500).json({
                success: false,
                error:
                    err.message ||
                    "Nie udało się pobrać pamięci."
            });

        }

    }

    async create(req, res) {

        try {

            const memory =
                await MemoryService.create(
                    req.user.id,
                    {
                        ...req.body,
                        source: "MANUAL"
                    }
                );

            res.status(201).json({
                success: true,
                memory
            });

        }
        catch (err) {

            res.status(400).json({
                success: false,
                error:
                    err.message ||
                    "Nie udało się utworzyć pamięci."
            });

        }

    }

    async update(req, res) {

        try {

            const memory =
                await MemoryService.update(
                    req.user.id,
                    req.params.id,
                    req.body
                );

            res.json({
                success: true,
                memory
            });

        }
        catch (err) {

            res.status(400).json({
                success: false,
                error:
                    err.message ||
                    "Nie udało się zaktualizować pamięci."
            });

        }

    }

    async archive(req, res) {

        try {

            const memory =
                await MemoryService.archive(
                    req.user.id,
                    req.params.id
                );

            res.json({
                success: true,
                memory
            });

        }
        catch (err) {

            res.status(400).json({
                success: false,
                error:
                    err.message ||
                    "Nie udało się zarchiwizować pamięci."
            });

        }

    }

}

module.exports = new MemoryController();