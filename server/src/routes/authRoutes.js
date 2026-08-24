import { Router } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
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

    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "O acesso ao sistema é exclusivo do administrador." });
    }

    const token = signSession(user);
    setSessionCookie(res, token);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/register", (_req, res) => {
  return res.status(410).json({ error: "O cadastro público de clínicas foi desativado." });
});

authRoutes.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.status(204).send();
});

authRoutes.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.publicUser });
});
