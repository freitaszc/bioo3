import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { AUTH_COOKIE, publicUser } from "../auth.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) {
      return res.status(401).json({ error: "Invalid session." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    req.user = user;
    req.publicUser = publicUser(user);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

