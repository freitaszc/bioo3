import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../clinicScope.js";

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);

const includeUser = { user: { select: { id: true, email: true } } };

adminRoutes.get("/clinics", async (req, res, next) => {
  try {
    const status = String(req.query.status || "").trim();
    const clinics = await prisma.clinic.findMany({
      where: status ? { status } : {}, include: includeUser, orderBy: [{ createdAt: "desc" }]
    });
    return res.json({ clinics });
  } catch (error) { next(error); }
});

adminRoutes.patch("/clinics/:id/approve", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.clinic.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Clínica não encontrada." });
    if (current.status !== "PENDING") return res.status(409).json({ error: "Somente clínicas pendentes podem ser aprovadas." });
    const clinic = await prisma.clinic.update({ where: { id }, data: { status: "ACTIVE", rejectionReason: "" }, include: includeUser });
    return res.json({ clinic });
  } catch (error) { if (error.code === "P2025") return res.status(404).json({ error: "Clínica não encontrada." }); next(error); }
});

adminRoutes.patch("/clinics/:id/reject", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "Informe o motivo da rejeição." });
    const current = await prisma.clinic.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Clínica não encontrada." });
    if (current.status !== "PENDING") return res.status(409).json({ error: "Somente clínicas pendentes podem ser rejeitadas." });
    const clinic = await prisma.clinic.update({ where: { id }, data: { status: "REJECTED", rejectionReason: reason }, include: includeUser });
    return res.json({ clinic });
  } catch (error) { if (error.code === "P2025") return res.status(404).json({ error: "Clínica não encontrada." }); next(error); }
});

adminRoutes.patch("/clinics/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || "");
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) return res.status(400).json({ error: "Status inválido." });
    const clinic = await prisma.clinic.update({ where: { id }, data: { status }, include: includeUser });
    return res.json({ clinic });
  } catch (error) { if (error.code === "P2025") return res.status(404).json({ error: "Clínica não encontrada." }); next(error); }
});

adminRoutes.patch("/clinics/:id/email", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "E-mail inválido." });
    const clinic = await prisma.clinic.findUnique({ where: { id }, include: includeUser });
    if (!clinic?.user) return res.status(404).json({ error: "Conta da clínica não encontrada." });
    await prisma.user.update({ where: { id: clinic.user.id }, data: { email, username: email } });
    return res.json({ clinic: { ...clinic, user: { ...clinic.user, email } } });
  } catch (error) { if (error.code === "P2002") return res.status(409).json({ error: "Este e-mail já está em uso." }); next(error); }
});
