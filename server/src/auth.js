import jwt from "jsonwebtoken";

export const AUTH_COOKIE = "bioo3_session";
const SESSION_DAYS = 7;

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    secondName: user.secondName,
    birthdate: user.birthdate ? user.birthdate.toISOString().slice(0, 10) : "",
    email: user.email || "",
    profileImagePath: user.profileImagePath || "/assets/user-icon.png"
  };
}

export function signSession(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required.");
  }

  return jwt.sign(
    { sub: String(user.id), username: user.username },
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

