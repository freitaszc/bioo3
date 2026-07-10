import bcrypt from "bcrypt";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { publicUser } from "../auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const accountRoutes = Router();

accountRoutes.use(requireAuth);

accountRoutes.get("/profile", (req, res) => {
  return res.json({ user: req.publicUser });
});

accountRoutes.put("/profile", async (req, res, next) => {
  try {
    const firstName = String(req.body?.firstName || "").trim();
    const emailRaw = String(req.body?.email || "").trim();
    const profileImagePath = String(req.body?.profileImagePath || "/assets/user-icon.png").trim();

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName,
        ...(req.user.role === "ADMIN" ? { email: emailRaw || null, username: emailRaw || req.user.username } : {}),
        profileImagePath: profileImagePath || "/assets/user-icon.png"
      }
    });

    const withClinic = await prisma.user.findUnique({ where: { id: user.id }, include: { clinic: true } });
    return res.json({ user: publicUser(withClinic) });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Este e-mail já está em uso." });
    }
    next(error);
  }
});

accountRoutes.put("/password", async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "A nova senha precisa ter pelo menos 8 caracteres." });
    }

    const matches = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Senha atual incorreta." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash }
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});
