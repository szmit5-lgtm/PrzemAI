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
const agentRoutes = require("./api/routes/agentRoutes");
const financeRoutes = require("./api/routes/financeRoutes");
const organizationRoutes = require("./api/routes/organizationRoutes");
const adminRoutes = require("./api/routes/adminRoutes");
const whatsappRoutes = require("./api/routes/whatsappRoutes");

const app = express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:3001",
    credentials: true
  })
);

// Allow small inline raster logos for authenticated company branding while keeping
// the default JSON size limit for other API endpoints.
app.use("/api/organizations", express.json({ limit: "800kb" }));
app.use(express.json({ verify: (req, _res, buf) => { if (req.originalUrl?.startsWith("/api/whatsapp/webhook")) req.rawBody = Buffer.from(buf); } }));
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
app.use("/api/agents", agentRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/whatsapp", whatsappRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    application: "PrzemAI API",
    version: "1.1.0"
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
  console.error("[API] Unhandled request error", err?.name || "Error");

  res.status(500).json({
    success: false,
    error: "Wewnętrzny błąd serwera."
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
