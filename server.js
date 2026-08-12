require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./api/routes/authRoutes");
const documentRoutes = require("./api/routes/documentRoutes");
const meetingRoutes = require("./api/routes/meetingRoutes");
const historyRoutes = require("./api/routes/historyRoutes");
const taskRoutes = require("./api/routes/taskRoutes");
const executiveRoutes = require("./api/routes/executiveRoutes");
const chatRoutes = require("./api/routes/chatRoutes");
const memoryRoutes = require("./api/routes/memoryRoutes");
const settingsRoutes = require("./api/routes/settingsRoutes");

const app = express();

app.use(
    cors({
        origin:
            process.env.FRONTEND_URL ||
            "http://localhost:3001",
        credentials: true
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/document", documentRoutes);
app.use("/api/meeting", meetingRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/executive", executiveRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/", (req, res) => {

    res.json({
        success: true,
        application: "PrzemAI API",
        version: "1.0.0"
    });

});

app.get("/health", (req, res) => {

    res.status(200).json({
        success: true,
        status: "ok"
    });

});

app.use((req, res) => {

    res.status(404).json({
        success: false,
        error: "Endpoint nie istnieje."
    });

});

app.use((err, req, res, next) => {

    console.error(err);

    res.status(500).json({
        success: false,
        error:
            err.message ||
            "Wewnętrzny błąd serwera."
    });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("=======================================");
    console.log("PrzemAI API");
    console.log(`PORT: ${PORT}`);
    console.log("HOST: 0.0.0.0");
    console.log("=======================================");
    console.log("");

});