const HistoryService = require("../services/HistoryService");
const MeetingService = require("../services/MeetingService");
const TaskService = require("../services/TaskService");

class MeetingController {

    async analyze(req, res) {

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error: "Nie wybrano pliku."

                });

            }

            const report = await MeetingService.analyze(

                req.file.path

            );

            await HistoryService.create({

                title: req.file.originalname,

                filename: req.file.filename,

                type: "meeting",

                report,

                userId: req.user.id

            });

            if (Array.isArray(report.actionItems)) {

                for (const item of report.actionItems) {

                    await TaskService.create({

                        title: item.title,

                        description: item.description,

                        priority: item.priority || "MEDIUM",

                        dueDate: item.dueDate || null,

                        userId: req.user.id

                    });

                }

            }

            return res.json({

                success: true,

                filename: req.file.originalname,

                report

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

module.exports = MeetingController;