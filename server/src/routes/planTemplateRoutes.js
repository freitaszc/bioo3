import { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../clinicScope.js";

export const planTemplateRoutes = Router();
planTemplateRoutes.use(requireAuth);

const FREQUENCIES = new Set(["WEEKLY", "BIWEEKLY", "MONTHLY"]);
const ROUTES = new Set(["INTRAMUSCULAR", "INTRAVENOUS", "SUBCUTANEOUS"]);
const REFERENCES_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/references.json");

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function inferRoute(text = "") {
  const value = String(text).toLowerCase();
  if (/\b(iv|intravenos)/i.test(value)) return "INTRAVENOUS";
  if (/\b(sc|subcut)/i.test(value)) return "SUBCUTANEOUS";
  return "INTRAMUSCULAR";
}

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
      preparation: item.preparation,
      application: item.application,
      quantity: item.quantity,
      unit: item.unit,
      sessions: item.sessions,
      intervalDays: item.intervalDays,
      unitPrice: Number(item.unitPrice || 0)
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
    preparation: String(item?.preparation || "").trim(),
    application: String(item?.application || "").trim(),
    quantity: numberOr(item?.quantity, 0),
    unit: String(item?.unit || "DOSE").trim().toUpperCase(),
    sessions: numberOr(item?.sessions, sessions),
    intervalDays: numberOr(item?.intervalDays, 7),
    unitPrice: numberOr(item?.unitPrice, 0)
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
    if (!item.unit) return "Informe a unidade de todos os produtos.";
    if (!Number.isInteger(item.sessions) || item.sessions < 1 || item.sessions > 100) {
      return "As sessões de cada produto devem ser um número inteiro entre 1 e 100.";
    }
    if (!Number.isInteger(item.intervalDays) || item.intervalDays < 1 || item.intervalDays > 365) {
      return "O intervalo de cada produto deve ser um número inteiro entre 1 e 365 dias.";
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return "Informe um preço válido para todos os produtos.";
    }
  }

  return null;
}

const includeItems = { items: { orderBy: { id: "asc" } } };

planTemplateRoutes.get("/catalog", async (_req, res, next) => {
  try {
    const references = JSON.parse(await readFile(REFERENCES_PATH, "utf8"));
    const products = new Map();
    for (const reference of Object.values(references || {})) {
      const medications = reference?.medications || {};
      for (const group of [medications.low, medications.high]) {
        const entries = Array.isArray(group) ? group : [];
        for (const entry of entries) {
          const name = String(entry?.nome || "").trim();
          if (!name) continue;
          const key = name.toLocaleLowerCase("pt-BR");
          if (!products.has(key)) {
            products.set(key, {
              name,
              preparation: String(entry?.preparo || "").trim(),
              application: String(entry?.aplicacao || "").trim(),
              route: inferRoute(`${entry?.preparo || ""} ${entry?.aplicacao || ""}`)
            });
          }
        }
      }
    }
    return res.json({ products: [...products.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) });
  } catch (error) {
    next(error);
  }
});

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
