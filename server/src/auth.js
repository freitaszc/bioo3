import jwt from "jsonwebtoken";

export const AUTH_COOKIE = "bioo3_session";
const SESSION_DAYS = 7;

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    email: user.email || "",
    profileImagePath: user.profileImagePath || "/assets/user-icon.png",
    role: user.role,
    clinicId: user.clinicId,
    clinic: user.clinic ? {
      id: user.clinic.id,
      name: user.clinic.name,
      status: user.clinic.status,
      rejectionReason: user.clinic.rejectionReason
    } : null
  };
}

export function signSession(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required.");
  }

  return jwt.sign(
    { sub: String(user.id) },
    secret,
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

export function setSessionCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
}
