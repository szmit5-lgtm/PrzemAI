const TaskService = require("./TaskService");
const HistoryService = require("./HistoryService");
const AIEngine = require("../../core/ai/AIEngine");

class ExecutiveService {

    constructor() {

        this.ai = new AIEngine();

    }

    async getDashboard(userId) {

        const tasks = await TaskService.list(userId);
        const history = await HistoryService.list(userId);

        const todo = tasks.filter(
            task => task.status !== "DONE"
        );

        const done = tasks.filter(
            task => task.status === "DONE"
        );

        const highPriority = todo.filter(
            task => task.priority === "HIGH"
        );

        const overdue = todo.filter(task => {

            if (!task.dueDate) {

                return false;

            }

            return new Date(task.dueDate) < new Date();

        });

        const documents = history.filter(
            item => item.type === "document"
        );

        const meetings = history.filter(
            item => item.type === "meeting"
        );

        const briefing = await this.generateBriefing({

            todo,
            done,
            highPriority,
            overdue,
            documents,
            meetings

        });

        return {

            summary: {

                openTasks: todo.length,

                completedTasks: done.length,

                highPriorityTasks: highPriority.length,

                overdueTasks: overdue.length,

                documents: documents.length,

                meetings: meetings.length

            },

            briefing,

            tasks: todo.slice(0, 5),

            recentHistory: history.slice(0, 5)

        };

    }

    async generateBriefing(data) {

        const prompt = `
Jesteś Executive AI Assistant.

Na podstawie poniższych danych przygotuj krótki briefing biznesowy.

Dane:

Otwarte zadania: ${data.todo.length}
Wykonane zadania: ${data.done.length}
Zadania wysokiego priorytetu: ${data.highPriority.length}
Przeterminowane zadania: ${data.overdue.length}
Analizy dokumentów: ${data.documents.length}
Analizy spotkań: ${data.meetings.length}

Otwarte zadania:

${JSON.stringify(
    data.todo.map(task => ({
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate
    })),
    null,
    2
)}

Napisz:

- krótkie podsumowanie dnia,
- co jest najważniejsze,
- co wymaga natychmiastowej uwagi,
- co rekomendujesz zrobić jako pierwsze.

Odpowiadaj po polsku.
Nie używaj Markdown.
Maksymalnie 200 słów.
`;

        try {

            return await this.ai.ask({

                system: "Jesteś Executive Business Assistant.",

                user: prompt

            });

        } catch (err) {

            return "Nie udało się wygenerować briefingu Executive AI.";

        }

    }

}

module.exports = new ExecutiveService();