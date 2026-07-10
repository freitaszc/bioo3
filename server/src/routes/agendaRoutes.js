import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clinicWhere, handleScopeError, requireActiveClinic, selectedClinicId } from "../clinicScope.js";

export const agendaRoutes = Router();

agendaRoutes.use(requireAuth);

function serializeEvent(event) {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    date: event.startsAt.toISOString().slice(0, 10),
    time: event.startsAt.toISOString().slice(11, 16),
    notes: event.notes
    ,clinicId: event.clinicId
    ,clinicName: event.clinic?.name || ""
    ,patientId: event.patientId
    ,patientName: event.patient?.name || ""
  };
}

function normalizeEventInput(body) {
  const title = String(body?.title || "").trim();
  const day = String(body?.day || "").trim();
  const time = String(body?.time || "").trim();
  const notes = String(body?.notes || "").trim();
  const patientId = body?.patientId ? Number(body.patientId) : null;
  const startsAt = new Date(`${day}T${time || "00:00"}:00`);

  return { title, day, time, notes, patientId, startsAt };
}

function eventDedupeKey({ clinicId, title, startsAt, notes, patientId }) {
  return [clinicId, startsAt.toISOString(), title, notes, patientId || ""].join("|");
}

async function findEventPatient(patientId, clinicId) {
  if (!patientId) return null;
  if (!Number.isInteger(patientId)) return undefined;
  return prisma.patient.findFirst({ where: { id: patientId, clinicId } });
}

agendaRoutes.get("/", async (req, res, next) => {
  try {
    const month = String(req.query.month || "").trim();
    const monthStart = month ? new Date(`${month}-01T00:00:00`) : new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const events = await prisma.agendaEvent.findMany({
      where: {
        startsAt: {
          gte: monthStart,
          lt: monthEnd
        }, ...clinicWhere(req)
      },
      include: { clinic: true, patient: true },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }]
    });

    return res.json({ events: events.map(serializeEvent) });
  } catch (error) {
    next(error);
  }
});

agendaRoutes.post("/", async (req, res, next) => {
  try {
    const input = normalizeEventInput(req.body);
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    if (!input.title || !input.day || Number.isNaN(input.startsAt.getTime()) || (input.patientId !== null && !Number.isInteger(input.patientId))) {
      return res.status(400).json({ error: "Informe título, dia e horário do evento." });
    }

    const patient = await findEventPatient(input.patientId, clinicId);
    if (input.patientId && !patient) return res.status(404).json({ error: "Paciente não encontrado." });
    const dedupeKey = eventDedupeKey({ ...input, clinicId });
    const existing = await prisma.agendaEvent.findUnique({ where: { dedupeKey }, include: { clinic: true, patient: true } });
    if (existing) return res.status(200).json({ event: serializeEvent(existing) });

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.agendaEvent.create({
        data: { title: input.title, startsAt: input.startsAt, notes: input.notes, clinicId, patientId: patient?.id || null, dedupeKey },
        include: { clinic: true, patient: true }
      });
      if (patient) {
        await tx.consultation.create({
          data: { patientId: patient.id, clinicId, notes: `Agendamento: ${input.title}${input.notes ? `\n\n${input.notes}` : ""}` }
        });
      }
      return created;
    });

    return res.status(201).json({ event: serializeEvent(event) });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Este agendamento já foi salvo." });
    }
    next(error);
  }
});

agendaRoutes.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = normalizeEventInput(req.body);
    if (!Number.isInteger(id) || !input.title || !input.day || Number.isNaN(input.startsAt.getTime()) || (input.patientId !== null && !Number.isInteger(input.patientId))) {
      return res.status(400).json({ error: "Evento inválido." });
    }

    const current = await prisma.agendaEvent.findFirst({ where: { id, ...clinicWhere(req) } });
    if (!current) return res.status(404).json({ error: "Evento não encontrado." });
    const patient = await findEventPatient(input.patientId, current.clinicId);
    if (input.patientId && !patient) return res.status(404).json({ error: "Paciente não encontrado." });
    const dedupeKey = eventDedupeKey({ ...input, clinicId: current.clinicId });

    const event = await prisma.agendaEvent.update({
      where: { id, ...clinicWhere(req) },
      data: {
        title: input.title,
        startsAt: input.startsAt,
        notes: input.notes,
        patientId: patient?.id || null,
        dedupeKey
      }, include: { clinic: true, patient: true }
    });

    if (patient && patient.id !== current.patientId) {
      await prisma.consultation.create({
        data: { patientId: patient.id, clinicId: current.clinicId, notes: `Agendamento: ${input.title}${input.notes ? `\n\n${input.notes}` : ""}` }
      });
    }

    return res.json({ event: serializeEvent(event) });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Evento não encontrado." });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Este agendamento já foi salvo." });
    }
    next(error);
  }
});

agendaRoutes.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Evento inválido." });
    }

    const result = await prisma.agendaEvent.deleteMany({ where: { id, ...clinicWhere(req) } });
    if (!result.count) return res.status(404).json({ error: "Evento não encontrado." });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Evento não encontrado." });
    }
    handleScopeError(error, res, next);
  }
});
