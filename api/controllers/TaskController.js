const TaskService = require("../services/TaskService");

class TaskController {

    async list(req, res) {

        try {

            const items = await TaskService.list(req.user.id);

            return res.json({
                success: true,
                items
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

    async get(req, res) {

        try {

            const item = await TaskService.get(
                req.params.id,
                req.user.id
            );

            if (!item) {

                return res.status(404).json({
                    success: false,
                    error: "Zadanie nie istnieje."
                });

            }

            return res.json({
                success: true,
                item
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

    async create(req, res) {

        try {

            const item = await TaskService.create({

                title: req.body.title,
                description: req.body.description,
                priority: req.body.priority,
                dueDate: req.body.dueDate,
                userId: req.user.id

            });

            return res.status(201).json({
                success: true,
                item
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

    async update(req, res) {

        try {

            const item = await TaskService.update(
                req.params.id,
                req.user.id,
                req.body
            );

            return res.json({
                success: true,
                item
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

    async complete(req, res) {

        try {

            const item = await TaskService.update(
                req.params.id,
                req.user.id,
                {
                    status: "DONE",
                    completedAt: new Date()
                }
            );

            return res.json({
                success: true,
                item
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

    async remove(req, res) {

        try {

            await TaskService.remove(
                req.params.id,
                req.user.id
            );

            return res.json({
                success: true,
                message: "Zadanie zostało usunięte."
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

}

module.exports = TaskController;