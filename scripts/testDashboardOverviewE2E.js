"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { performance } = require("node:perf_hooks");

async function main() {
    const database = new URL(process.env.DATABASE_URL);
    assert.equal(database.protocol, "postgresql:");
    assert.equal(database.hostname, "127.0.0.1");
    assert.match(database.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);

    process.env.JWT_SECRET = randomUUID();
    const jwt = require("jsonwebtoken");
    const express = require("express");
    const db = require("../lib/prisma");
    const { GENERAL_SOURCE } = require("../lib/agentCatalog");
    const { getDashboardOverview } = require("../api/services/DashboardOverviewService");
    const legacy = require("../api/services/ExecutiveService");
    // Measure the previous application path without calling a provider.
    legacy.generateBriefing = async () => "Synthetic briefing";
    const app = express();
    app.use("/api/executive", require("../api/routes/executiveRoutes"));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const users = [];

    try {
        for (let index = 0; index < 2; index++) {
            const user = await db.user.create({ data: { email: randomUUID() + "@example.test", password: "synthetic" } });
            users.push(user.id);
        }
        const [userId, otherUser] = users;
        const task = (data = {}) => ({ userId, title: "Synthetic task", ...data });
        await db.task.createMany({ data: [
            task({ dueDate: new Date("2020-01-01") }),
            task({ dueDate: new Date("2099-01-01") }),
            task({ status: "DONE", dueDate: new Date("2020-01-01") }),
            task({ source: "COMPANY" }), task({ source: GENERAL_SOURCE }),
            task({ investmentScoped: true }), task({ userId: otherUser })
        ] });

        const endpoint = "http://127.0.0.1:" + server.address().port + "/api/executive/overview";
        assert.equal((await fetch(endpoint)).status, 401);
        // The identity in the token is authoritative even with a supplied query string.
        const response = await fetch(endpoint + "?userId=" + encodeURIComponent(otherUser), {
            headers: { Authorization: "Bearer " + jwt.sign({ id: userId }, process.env.JWT_SECRET) }
        });
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control"), /no-store/);
        assert.deepEqual((await response.json()).dashboard.summary, { openTasks: 2, completedTasks: 1, overdueTasks: 1 });

        for (let index = 0; index < 10; index++) {
            await Promise.all([
                db.task.createMany({ data: Array.from({ length: 500 }, () => task()) }),
                db.history.createMany({ data: Array.from({ length: 500 }, () => ({
                    userId, type: "document", title: "Synthetic history", filename: "synthetic.txt", report: {}
                })) })
            ]);
        }

        const before = () => legacy.getDashboard(userId);
        const after = () => getDashboardOverview(userId, db);
        await before();
        await after();
        async function elapsed(operation) {
            const initial = performance.now();
            const data = await operation();
            return { ms: performance.now() - initial, bytes: Buffer.byteLength(JSON.stringify(data)) };
        }
        const oldTimes = [];
        const newTimes = [];
        for (let sample = 0; sample < 11; sample++) {
            oldTimes.push(await elapsed(before));
            newTimes.push(await elapsed(after));
        }
        const median = rows => rows.sort((a, b) => a.ms - b.ms)[5];
        console.log("Dashboard overview E2E OK. 5000 synthetic tasks and 5000 history rows added to the access-control fixtures.");
        console.log(JSON.stringify({ legacyMedian: median(oldTimes), overviewMedian: median(newTimes) }));
    } finally {
        await new Promise(resolve => server.close(resolve));
        try {
            await db.user.deleteMany({ where: { id: { in: users } } });
        } finally {
            await db.$disconnect();
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
