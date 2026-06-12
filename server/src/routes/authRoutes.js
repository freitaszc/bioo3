import bcrypt from "bcrypt";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { clearSessionCookie, publicUser, setSessionCookie, signSession } from "../auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRoutes = Router();

authRoutes.post("/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Usuário e senha são obrigatórios." });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = signSession(user);
    setSessionCookie(res, token);
    return res.json({ user: publicUser(user) });
  } catch (error) {
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

