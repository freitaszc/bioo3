import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { accountRoutes } from "./routes/accountRoutes.js";
import { agendaRoutes } from "./routes/agendaRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { dashboardRoutes } from "./routes/dashboardRoutes.js";
import { labRoutes } from "./routes/labRoutes.js";
import { patientRoutes } from "./routes/patientRoutes.js";
import { productRoutes } from "./routes/productRoutes.js";
import { planTemplateRoutes } from "./routes/planTemplateRoutes.js";
import { patientPlanRoutes } from "./routes/patientPlanRoutes.js";
import { inventoryRoutes } from "./routes/inventoryRoutes.js";
import { cashRoutes } from "./routes/cashRoutes.js";
import { videoRoutes } from "./routes/videoRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { webhookRoutes } from "./routes/webhookRoutes.js";
import { startBackgroundWorker } from "./services/backgroundWorker.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isSameRequestOrigin(req, origin) {
  try {
    const originUrl = new URL(origin);
    const forwardedHost = req.get("x-forwarded-host");
    const requestHost = forwardedHost || req.get("host");
    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const requestProto = forwardedProto || req.protocol;

    return originUrl.host === requestHost && originUrl.protocol === `${requestProto}:`;
  } catch {
    return false;
  }
}

app.use(cors((req, callback) => {
  callback(null, {
    origin(origin, originCallback) {
      if (!origin || clientOrigins.includes(origin) || isSameRequestOrigin(req, origin)) {
        return originCallback(null, true);
      }

      if (req.path.startsWith("/api")) {
        return originCallback(new Error("Origin not allowed by CORS."));
      }

      return originCallback(null, false);
    },
    credentials: true
  });
}));
app.use(express.json({
  limit: "15mb",
  verify(req, _res, buffer) {
    req.rawBody = Buffer.from(buffer);
  }
}));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/lab", labRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/products", productRoutes);
app.use("/api/plan-templates", planTemplateRoutes);
app.use("/api/patient-plans", patientPlanRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/cash", cashRoutes);
app.use("/api/agenda", agendaRoutes);

// Serve client build in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT") {
    return res.status(413).json({ error: "O lote excede o limite de 50 PDFs ou 100 MB." });
  }
  if (error.message === "Todos os arquivos devem ser PDFs.") {
    return res.status(400).json({ error: error.message });
  }
  res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Erro interno do servidor." });
});

const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  console.log(`BioO3 API listening on http://${host}:${port}`);
  startBackgroundWorker().catch((error) => console.error("Background worker failed to start:", error));
});
