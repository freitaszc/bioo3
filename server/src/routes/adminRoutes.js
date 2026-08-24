import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../clinicScope.js";
import { normalizeWhatsAppPhone, validWhatsAppPhone } from "../inputSanitizers.js";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppConnection,
  publicConnection,
  testWhatsAppConnection
} from "../services/whatsapp.js";

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);

function clinicInput(body) {
  return {
    name: String(body?.name || "").trim().replace(/\s+/g, " ").slice(0, 160),
    whatsappPhone: normalizeWhatsAppPhone(body?.whatsappPhone),
    status: String(body?.status || "ACTIVE").toUpperCase()
  };
}

function validateClinic(input) {
  if (input.name.length < 2) return "Informe o nome da clínica.";
  if (!validWhatsAppPhone(input.whatsappPhone)) return "Informe um WhatsApp válido com DDD.";
  if (!["ACTIVE", "SUSPENDED"].includes(input.status)) return "Status de clínica inválido.";
  return "";
}

adminRoutes.get("/clinics", async (req, res, next) => {
  try {
    const status = String(req.query.status || "").trim();
    const clinics = await prisma.clinic.findMany({
      where: status ? { status } : {},
      orderBy: [{ name: "asc" }, { id: "asc" }]
    });
    return res.json({ clinics });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/clinics", async (req, res, next) => {
  try {
    const input = clinicInput(req.body);
    const error = validateClinic(input);
    if (error) return res.status(400).json({ error });
    const clinic = await prisma.clinic.create({ data: { ...input, rejectionReason: "" } });
    return res.status(201).json({ clinic });
  } catch (error) {
    next(error);
  }
});

adminRoutes.put("/clinics/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Clínica inválida." });
    const input = clinicInput(req.body);
    const error = validateClinic(input);
    if (error) return res.status(400).json({ error });
    const clinic = await prisma.clinic.update({ where: { id }, data: input });
    return res.json({ clinic });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Clínica não encontrada." });
    next(error);
  }
});

adminRoutes.patch("/clinics/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || "").toUpperCase();
    if (!Number.isInteger(id) || !["ACTIVE", "SUSPENDED"].includes(status)) {
      return res.status(400).json({ error: "Clínica ou status inválido." });
    }
    const clinic = await prisma.clinic.update({ where: { id }, data: { status } });
    return res.json({ clinic });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Clínica não encontrada." });
    next(error);
  }
});

adminRoutes.delete("/clinics/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Clínica inválida." });
    await prisma.clinic.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Clínica não encontrada." });
    if (error.code === "P2003") {
      return res.status(409).json({ error: "Esta clínica possui dados históricos. Inative-a em vez de excluir." });
    }
    next(error);
  }
});

adminRoutes.get("/whatsapp", async (_req, res, next) => {
  try {
    return res.json({ connection: publicConnection(await getWhatsAppConnection()) });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/whatsapp/connect", async (req, res, next) => {
  try {
    return res.json({ connection: await connectWhatsApp(req.body || {}) });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post("/whatsapp/test", async (_req, res, next) => {
  try {
    return res.json(await testWhatsAppConnection());
  } catch (error) {
    next(error);
  }
});

adminRoutes.delete("/whatsapp", async (_req, res, next) => {
  try {
    return res.json({ connection: await disconnectWhatsApp() });
  } catch (error) {
    next(error);
  }
});
