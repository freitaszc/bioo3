export function isAdmin(req) {
  return req.user?.role === "ADMIN";
}

export function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ error: "Acesso exclusivo do administrador." });
  next();
}

export function selectedClinicId(req, { required = false } = {}) {
  if (!isAdmin(req)) return req.user.clinicId;
  const raw = req.query?.clinicId ?? req.body?.clinicId;
  if (raw === undefined || raw === null || raw === "") {
    if (required) {
      const error = new Error("Selecione uma clínica para realizar esta operação.");
      error.statusCode = 400;
      throw error;
    }
    return null;
  }
  const id = Number(raw);
  if (!Number.isInteger(id)) {
    const error = new Error("Clínica inválida.");
    error.statusCode = 400;
    throw error;
  }
  return id;
}

export function clinicWhere(req) {
  const clinicId = selectedClinicId(req);
  return clinicId ? { clinicId } : {};
}

export async function requireActiveClinic(prisma, clinicId) {
  const clinic = await prisma.clinic.findFirst({ where: { id: clinicId, status: "ACTIVE" } });
  if (!clinic) {
    const error = new Error("Clínica ativa não encontrada.");
    error.statusCode = 400;
    throw error;
  }
  return clinic;
}

export function handleScopeError(error, res, next) {
  if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
  return next(error);
}
