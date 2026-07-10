import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../clinicScope.js";

export const planTemplateRoutes = Router();
planTemplateRoutes.use(requireAuth);

const FREQUENCIES = new Set(["WEEKLY", "BIWEEKLY", "MONTHLY"]);
const ROUTES = new Set(["INTRAMUSCULAR", "INTRAVENOUS", "SUBCUTANEOUS"]);

function serializeTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    frequency: template.frequency,
    sessions: template.sessions,
    items: (template.items || []).map((item) => ({
      id: item.id,
      productName: item.productName,
      route: item.route,
      quantity: item.quantity
    })),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };
}

function normalizeInput(body) {
  const name = String(body?.name || "").trim();
  const description = String(body?.description || "").trim();
  const frequency = String(body?.frequency || "").trim().toUpperCase();
  const sessions = Number(body?.sessions ?? 4);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items = rawItems.map((item) => ({
    productName: String(item?.productName || "").trim(),
    route: String(item?.route || "").trim().toUpperCase(),
    quantity: Number(item?.quantity)
  }));

  return { name, description, frequency, sessions, items };
}

function validateInput(input) {
  if (input.name.length < 2) return "Informe um nome para o modelo.";
  if (!FREQUENCIES.has(input.frequency)) return "Informe uma frequência válida.";
  if (!Number.isInteger(input.sessions) || input.sessions < 1 || input.sessions > 100) {
    return "A quantidade de sessões deve ser um número inteiro entre 1 e 100.";
  }
  if (!input.items.length) return "Adicione pelo menos um produto ao modelo.";

  for (const item of input.items) {
    if (!item.productName) return "Informe o nome de todos os produtos.";
    if (!ROUTES.has(item.route)) return "Informe uma via válida para todos os produtos.";
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return "A quantidade de cada produto deve ser um número inteiro maior que zero.";
    }
  }

  return null;
}

const includeItems = { items: { orderBy: { id: "asc" } } };

planTemplateRoutes.get("/", async (_req, res, next) => {
  try {
    const templates = await prisma.planTemplate.findMany({
      include: includeItems,
      orderBy: [{ name: "asc" }, { id: "asc" }]
    });
    return res.json({ templates: templates.map(serializeTemplate) });
  } catch (error) {
    next(error);
  }
});

planTemplateRoutes.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = normalizeInput(req.body);
    const validationError = validateInput(input);
    if (validationError) return res.status(400).json({ error: validationError });

    const template = await prisma.planTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        frequency: input.frequency,
        sessions: input.sessions,
        items: { create: input.items }
      },
      include: includeItems
    });
    return res.status(201).json({ template: serializeTemplate(template) });
  } catch (error) {
    next(error);
  }
});

planTemplateRoutes.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = normalizeInput(req.body);
    const validationError = validateInput(input);
    if (!Number.isInteger(id) || validationError) {
      return res.status(400).json({ error: validationError || "Modelo inválido." });
    }

    const template = await prisma.planTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        frequency: input.frequency,
        sessions: input.sessions,
        items: {
          deleteMany: {},
          create: input.items
        }
      },
      include: includeItems
    });
    return res.json({ template: serializeTemplate(template) });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Modelo não encontrado." });
    next(error);
  }
});

planTemplateRoutes.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Modelo inválido." });

    await prisma.planTemplate.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Modelo não encontrado." });
    next(error);
  }
});
