const prisma = require("../../lib/prisma");

class SettingsService {

    async get(userId) {

        return prisma.userSettings.upsert({

            where: {
                userId
            },

            update: {},

            create: {
                userId
            }

        });

    }

    async update(userId, data) {

        return prisma.userSettings.upsert({

            where: {
                userId
            },

            update: {

                memoryEnabled:
                    data.memoryEnabled,

                historyEnabled:
                    data.historyEnabled,

                executiveMode:
                    data.executiveMode,

                aiModel:
                    data.aiModel

            },

            create: {

                userId,

                memoryEnabled:
                    data.memoryEnabled ?? true,

                historyEnabled:
                    data.historyEnabled ?? true,

                executiveMode:
                    data.executiveMode ?? true,

                aiModel:
                    data.aiModel || "gpt-5.5"

            }

        });

    }

}

module.exports = new SettingsService();