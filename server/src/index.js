import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { accountRoutes } from "./routes/accountRoutes.js";
import { agendaRoutes } from "./routes/agendaRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { dashboardRoutes } from "./routes/dashboardRoutes.js";
import { labRoutes } from "./routes/labRoutes.js";
import { patientRoutes } from "./routes/patientRoutes.js";
import { productRoutes } from "./routes/productRoutes.js";
import { videoRoutes } from "./routes/videoRoutes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || clientOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS."));
  },
  credentials: true
}));
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/lab", labRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/products", productRoutes);
app.use("/api/agenda", agendaRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  console.log(`BioO3 API listening on http://${host}:${port}`);
});
