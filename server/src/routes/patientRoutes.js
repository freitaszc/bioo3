import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clinicWhere, handleScopeError, requireActiveClinic, selectedClinicId } from "../clinicScope.js";
import { digitsOnly, validPhone } from "../inputSanitizers.js";

export const patientRoutes = Router();

patientRoutes.use(requireAuth);

function normalizePatientInput(body) {
  const name = String(body?.name || "").trim();
  const age = Number(body?.age);
  const cpf = String(body?.cpf || "").trim();
  const gender = String(body?.gender || "").trim();
  const phone = digitsOnly(body?.phone, 11);
  const prescription = String(body?.prescription || "").trim();
  const doctorId = body?.doctorId ? Number(body.doctorId) : null;

  return { name, age, cpf, gender, phone, prescription, doctorId };
}

function serializePatient(patient) {
  return {
    id: patient.id,
    name: patient.name,
    age: patient.age,
    cpf: patient.cpf,
    gender: patient.gender,
    phone: patient.phone,
    status: patient.status,
    prescription: patient.prescription,
    doctorId: patient.doctorId,
    doctorName: patient.doctor?.name || "Não informado",
    createdAt: patient.createdAt,
    consultations: patient.consultations || [],
    analysisEvents: (patient.analysisEvents || []).map((event) => ({
      id: event.id,
      source: event.source,
      createdAt: event.createdAt
    }))
    ,clinicId: patient.clinicId
    ,clinicName: patient.clinic?.name || ""
  };
}

async function ensureDoctor(doctorId, clinicId) {
  if (!doctorId) return null;
  if (!Number.isInteger(doctorId)) {
    throw new Error("Médico inválido.");
  }
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId } });
  if (!doctor) {
    throw new Error("Médico não encontrado.");
  }
  return doctor.id;
}

patientRoutes.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const recentSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [patients, totalPatients, recentAnalyses, recentPatients] = await Promise.all([
      prisma.patient.findMany({
        where: {
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          ...(status ? { status } : {}),
          ...clinicWhere(req)
        },
        include: { doctor: true, clinic: true },
        orderBy: [{ name: "asc" }, { id: "asc" }]
      }),
      prisma.patient.count({ where: clinicWhere(req) }),
      prisma.analysisEvent.count({ where: { createdAt: { gte: recentSince }, ...clinicWhere(req) } }),
      prisma.patient.count({ where: { createdAt: { gte: recentSince }, ...clinicWhere(req) } })
    ]);

    return res.json({
      patients: patients.map(serializePatient),
      summary: { totalPatients, recentAnalyses, recentPatients }
    });
  } catch (error) {
    next(error);
  }
});

patientRoutes.post("/", async (req, res, next) => {
  try {
    const input = normalizePatientInput(req.body);
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    if (!input.name || !Number.isInteger(input.age) || input.age < 0) {
      return res.status(400).json({ error: "Preencha nome e idade do paciente." });
    }
    if (input.phone && !validPhone(input.phone)) return res.status(400).json({ error: "Telefone deve ter 10 ou 11 dígitos." });

    let doctorId;
    try {
      doctorId = await ensureDoctor(input.doctorId, clinicId);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const patient = await prisma.patient.create({
      data: {
        name: input.name,
        age: input.age,
        cpf: input.cpf,
        gender: input.gender,
        phone: input.phone,
        prescription: input.prescription,
        doctorId,
        clinicId
      },
      include: { doctor: true, clinic: true }
    });

    return res.status(201).json({ patient: serializePatient(patient) });
  } catch (error) {
    next(error);
  }
});

patientRoutes.post("/bulk-delete", async (req, res, next) => {
  try {
    const ids = (req.body?.ids || []).map(Number).filter(Number.isInteger);
    if (!ids.length) {
      return res.status(400).json({ error: "Selecione pelo menos um paciente." });
    }

    const result = await prisma.patient.deleteMany({ where: { id: { in: ids }, ...clinicWhere(req) } });
    return res.json({ deletedCount: result.count });
  } catch (error) {
    next(error);
  }
});

patientRoutes.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Paciente inválido." });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, ...clinicWhere(req) },
      include: {
        doctor: true, clinic: true,
        consultations: { orderBy: { createdAt: "desc" } },
        analysisEvents: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: "Paciente não encontrado." });
    }

    return res.json({ patient: serializePatient(patient) });
  } catch (error) {
    next(error);
  }
});

patientRoutes.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = normalizePatientInput(req.body);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Paciente inválido." });
    }
    if (!input.name || !Number.isInteger(input.age) || input.age < 0) {
      return res.status(400).json({ error: "Preencha nome e idade do paciente." });
    }
    if (input.phone && !validPhone(input.phone)) return res.status(400).json({ error: "Telefone deve ter 10 ou 11 dígitos." });

    let doctorId;
    try {
      const current = await prisma.patient.findFirst({ where: { id, ...clinicWhere(req) } });
      if (!current) return res.status(404).json({ error: "Paciente não encontrado." });
      doctorId = await ensureDoctor(input.doctorId, current.clinicId);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const patient = await prisma.patient.update({
      where: { id, ...clinicWhere(req) },
      data: {
        name: input.name,
        age: input.age,
        cpf: input.cpf,
        gender: input.gender,
        phone: input.phone,
        prescription: input.prescription,
        doctorId
      },
      include: {
        doctor: true, clinic: true,
        consultations: { orderBy: { createdAt: "desc" } },
        analysisEvents: { orderBy: { createdAt: "desc" } }
      }
    });

    return res.json({ patient: serializePatient(patient) });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Paciente não encontrado." });
    }
    next(error);
  }
});

patientRoutes.patch("/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || "").trim();
    if (!Number.isInteger(id) || !["Ativo", "Inativo"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const patient = await prisma.patient.update({
      where: { id, ...clinicWhere(req) },
      data: { status },
      include: { doctor: true, clinic: true }
    });

    return res.json({ patient: serializePatient(patient) });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Paciente não encontrado." });
    }
    next(error);
  }
});

patientRoutes.post("/:id/consultations", async (req, res, next) => {
  try {
    const patientId = Number(req.params.id);
    const notes = String(req.body?.notes || "").trim();
    if (!Number.isInteger(patientId) || !notes) {
      return res.status(400).json({ error: "Informe as observações da consulta." });
    }

    const patient = await prisma.patient.findFirst({ where: { id: patientId, ...clinicWhere(req) } });
    if (!patient) return res.status(404).json({ error: "Paciente não encontrado." });
    const consultation = await prisma.consultation.create({
      data: { patientId, notes, clinicId: patient.clinicId }
    });

    return res.status(201).json({ consultation });
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(404).json({ error: "Paciente não encontrado." });
    }
    next(error);
  }
});

patientRoutes.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Paciente inválido." });
    }

    const result = await prisma.patient.deleteMany({ where: { id, ...clinicWhere(req) } });
    if (!result.count) return res.status(404).json({ error: "Paciente não encontrado." });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Paciente não encontrado." });
    }
    handleScopeError(error, res, next);
  }
});
