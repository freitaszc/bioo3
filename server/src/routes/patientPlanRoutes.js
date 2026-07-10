import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isAdmin } from "../clinicScope.js";

export const patientPlanRoutes = Router();
patientPlanRoutes.use(requireAuth);

const FREQUENCIES = new Set(["WEEKLY", "BIWEEKLY", "MONTHLY"]);
const STATUSES = new Set(["QUOTE", "ACTIVE", "COMPLETED", "CANCELED"]);
const SESSION_STATUSES = new Set(["PENDING", "SCHEDULED", "COMPLETED", "CANCELED"]);

const includePlan = {
  patient: { select: { id: true, name: true, clinicId: true } },
  template: { select: { id: true, name: true } },
  planSessions: { orderBy: { number: "asc" } }
};

function serializePlan(plan) {
  return {
    id: plan.id,
    patientId: plan.patientId,
    patientName: plan.patient?.name || "",
    clinicId: plan.clinicId,
    templateId: plan.templateId,
    templateName: plan.template?.name || "",
    name: plan.name,
    description: plan.description,
    frequency: plan.frequency,
    sessions: plan.sessions,
    status: plan.status,
    items: Array.isArray(plan.items) ? plan.items : [],
    planSessions: (plan.planSessions || []).map((session) => ({
      id: session.id,
      number: session.number,
      status: session.status,
      scheduledAt: session.scheduledAt,
      completedAt: session.completedAt,
      notes: session.notes
    })),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };
}

function patientWhere(req, patientId) {
  return isAdmin(req)
    ? { id: patientId }
    : { id: patientId, clinicId: req.user.clinicId };
}

function planWhere(req, id) {
  return isAdmin(req)
    ? { id }
    : { id, clinicId: req.user.clinicId };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    productName: String(item?.productName || "").trim(),
    route: String(item?.route || "").trim().toUpperCase(),
    quantity: Number(item?.quantity)
  }));
}

function validateItems(items) {
  if (!items.length) return "O plano precisa ter pelo menos um produto.";
  for (const item of items) {
    if (!item.productName) return "Informe o nome de todos os produtos.";
    if (!item.route) return "Informe a via de todos os produtos.";
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return "A quantidade dos produtos deve ser maior que zero.";
  }
  return null;
}

function normalizePlanInput(body, current = null) {
  const frequency = String(body?.frequency ?? current?.frequency ?? "").trim().toUpperCase();
  const sessions = Number(body?.sessions ?? current?.sessions);
  const description = String(body?.description ?? current?.description ?? "").trim();
  const items = body?.items === undefined
    ? (Array.isArray(current?.items) ? current.items : [])
    : normalizeItems(body.items);
  return { frequency, sessions, description, items };
}

function validatePlanInput(input) {
  if (!FREQUENCIES.has(input.frequency)) return "Informe uma frequência válida.";
  if (!Number.isInteger(input.sessions) || input.sessions < 1 || input.sessions > 100) return "A quantidade de sessões deve ser um número inteiro entre 1 e 100.";
  return validateItems(input.items);
}

async function findPatient(req, patientId) {
  return prisma.patient.findFirst({ where: patientWhere(req, patientId) });
}

patientPlanRoutes.get("/", async (req, res, next) => {
  try {
    const patientId = req.query.patientId === undefined ? null : Number(req.query.patientId);
    if (req.query.patientId !== undefined && !Number.isInteger(patientId)) return res.status(400).json({ error: "Paciente inválido." });

    const plans = await prisma.patientPlan.findMany({
      where: {
        ...(patientId === null ? {} : patientWhere(req, patientId)),
        ...(!isAdmin(req) ? { clinicId: req.user.clinicId } : {})
      },
      include: includePlan,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    return res.json({ plans: plans.map(serializePlan) });
  } catch (error) {
    next(error);
  }
});

patientPlanRoutes.post("/", async (req, res, next) => {
  try {
    const patientId = Number(req.body?.patientId);
    const templateId = Number(req.body?.templateId);
    if (!Number.isInteger(patientId) || !Number.isInteger(templateId)) return res.status(400).json({ error: "Selecione o paciente e o modelo do plano." });

    const patient = await findPatient(req, patientId);
    if (!patient) return res.status(404).json({ error: "Paciente não encontrado." });
    const template = await prisma.planTemplate.findUnique({ where: { id: templateId }, include: { items: { orderBy: { id: "asc" } } } });
    if (!template) return res.status(404).json({ error: "Modelo de plano não encontrado." });

    const input = normalizePlanInput({
      frequency: req.body?.frequency ?? template.frequency,
      sessions: req.body?.sessions ?? template.sessions,
      description: req.body?.description,
      items: req.body?.items ?? template.items
    });
    const validationError = validatePlanInput(input);
    if (validationError) return res.status(400).json({ error: validationError });

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.patientPlan.create({
        data: {
          patientId: patient.id,
          clinicId: patient.clinicId,
          templateId: template.id,
          name: template.name,
          description: input.description,
          frequency: input.frequency,
          sessions: input.sessions,
          status: "QUOTE",
          items: input.items,
          planSessions: {
            create: Array.from({ length: input.sessions }, (_, index) => ({ number: index + 1 }))
          }
        },
        include: includePlan
      });
      return created;
    });
    return res.status(201).json({ plan: serializePlan(plan) });
  } catch (error) {
    next(error);
  }
});

patientPlanRoutes.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Plano inválido." });
    const current = await prisma.patientPlan.findFirst({ where: planWhere(req, id), include: { planSessions: true } });
    if (!current) return res.status(404).json({ error: "Plano não encontrado." });

    const input = normalizePlanInput(req.body, current);
    const validationError = validatePlanInput(input);
    if (validationError) return res.status(400).json({ error: validationError });
    if (input.sessions < current.sessions && current.planSessions.some((session) => session.number > input.sessions && session.status === "COMPLETED")) {
      return res.status(409).json({ error: "Não é possível reduzir sessões que já foram concluídas." });
    }

    const plan = await prisma.$transaction(async (tx) => {
      const updated = await tx.patientPlan.update({
        where: { id },
        data: {
          description: input.description,
          frequency: input.frequency,
          sessions: input.sessions,
          items: input.items
        }
      });
      if (input.sessions < current.sessions) {
        await tx.planSession.deleteMany({ where: { patientPlanId: id, number: { gt: input.sessions } } });
      } else if (input.sessions > current.sessions) {
        await tx.planSession.createMany({
          data: Array.from({ length: input.sessions - current.sessions }, (_, index) => ({
            patientPlanId: id,
            number: current.sessions + index + 1
          }))
        });
      }
      return tx.patientPlan.findUnique({ where: { id }, include: includePlan });
    });
    return res.json({ plan: serializePlan(plan) });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Plano não encontrado." });
    next(error);
  }
});

patientPlanRoutes.patch("/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || "").trim().toUpperCase();
    if (!Number.isInteger(id) || !STATUSES.has(status)) return res.status(400).json({ error: "Status de plano inválido." });
    const current = await prisma.patientPlan.findFirst({ where: planWhere(req, id) });
    if (!current) return res.status(404).json({ error: "Plano não encontrado." });
    if (current.status === "CANCELED" || current.status === "COMPLETED") return res.status(409).json({ error: "Este plano não pode mais ser alterado." });
    if (status === "QUOTE" && current.status !== "QUOTE") return res.status(409).json({ error: "Somente planos em orçamento podem permanecer nesse status." });
    if (status === "ACTIVE" && current.status !== "QUOTE") return res.status(409).json({ error: "Somente planos em orçamento podem ser ativados." });
    if (status === "COMPLETED" && current.status !== "ACTIVE") return res.status(409).json({ error: "Somente planos ativos podem ser concluídos." });

    const plan = await prisma.patientPlan.update({ where: { id }, data: { status }, include: includePlan });
    return res.json({ plan: serializePlan(plan) });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Plano não encontrado." });
    next(error);
  }
});

patientPlanRoutes.patch("/:id/sessions/:sessionNumber", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const number = Number(req.params.sessionNumber);
    const status = String(req.body?.status || "").trim().toUpperCase();
    if (!Number.isInteger(id) || !Number.isInteger(number) || !SESSION_STATUSES.has(status)) return res.status(400).json({ error: "Sessão inválida." });
    const plan = await prisma.patientPlan.findFirst({ where: planWhere(req, id) });
    if (!plan) return res.status(404).json({ error: "Plano não encontrado." });
    const session = await prisma.planSession.update({
      where: { patientPlanId_number: { patientPlanId: id, number } },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
        notes: String(req.body?.notes || "").trim()
      }
    });
    return res.json({ session });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Sessão não encontrada." });
    next(error);
  }
});
