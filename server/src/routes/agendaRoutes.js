import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

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
  };
}

function normalizeEventInput(body) {
  const title = String(body?.title || "").trim();
  const day = String(body?.day || "").trim();
  const time = String(body?.time || "").trim();
  const notes = String(body?.notes || "").trim();
  const startsAt = new Date(`${day}T${time || "00:00"}:00`);

  return { title, day, time, notes, startsAt };
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
        }
      },
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
    if (!input.title || !input.day || Number.isNaN(input.startsAt.getTime())) {
      return res.status(400).json({ error: "Informe título, dia e horário do evento." });
    }

    const event = await prisma.agendaEvent.create({
      data: {
        title: input.title,
        startsAt: input.startsAt,
        notes: input.notes
      }
    });

    return res.status(201).json({ event: serializeEvent(event) });
  } catch (error) {
    next(error);
  }
});

agendaRoutes.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = normalizeEventInput(req.body);
    if (!Number.isInteger(id) || !input.title || !input.day || Number.isNaN(input.startsAt.getTime())) {
      return res.status(400).json({ error: "Evento inválido." });
    }

    const event = await prisma.agendaEvent.update({
      where: { id },
      data: {
        title: input.title,
        startsAt: input.startsAt,
        notes: input.notes
      }
    });

    return res.json({ event: serializeEvent(event) });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Evento não encontrado." });
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

    await prisma.agendaEvent.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Evento não encontrado." });
    }
    next(error);
  }
});
