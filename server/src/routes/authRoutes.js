import bcrypt from "bcrypt";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { clearSessionCookie, publicUser, setSessionCookie, signSession } from "../auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRoutes = Router();

authRoutes.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { clinic: true } });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    if (user.role === "CLINIC") {
      const messages = {
        PENDING: "Seu cadastro está aguardando aprovação.",
        REJECTED: `Seu cadastro foi rejeitado.${user.clinic?.rejectionReason ? ` Motivo: ${user.clinic.rejectionReason}` : ""}`,
        SUSPENDED: "O acesso desta clínica está suspenso."
      };
      if (user.clinic?.status !== "ACTIVE") {
        return res.status(403).json({ error: messages[user.clinic?.status] || "Acesso da clínica indisponível." });
      }
    }

    const token = signSession(user);
    setSessionCookie(res, token);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/register", async (req, res, next) => {
  try {
    const clinicName = String(req.body?.clinicName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!clinicName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return res.status(400).json({ error: "Informe a clínica, um e-mail válido e uma senha de pelo menos 8 caracteres." });
    }

    const existing = await prisma.user.findUnique({ where: { email }, include: { clinic: true } });
    if (existing && (existing.role === "ADMIN" || existing.clinic?.status !== "REJECTED")) {
      return res.status(409).json({ error: "Este e-mail já possui um cadastro." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    if (existing) {
      await prisma.$transaction([
        prisma.clinic.update({ where: { id: existing.clinicId }, data: { name: clinicName, status: "PENDING", rejectionReason: "" } }),
        prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
      ]);
    } else {
      await prisma.clinic.create({
        data: {
          name: clinicName,
          user: { create: { username: email, email, passwordHash, role: "CLINIC", firstName: clinicName } }
        }
      });
    }
    return res.status(201).json({ message: "Cadastro enviado para aprovação. O administrador analisará o acesso na seção de Clínicas." });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Este e-mail já possui um cadastro." });
    next(error);
  }
});

authRoutes.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.status(204).send();
});

authRoutes.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.publicUser });
});
