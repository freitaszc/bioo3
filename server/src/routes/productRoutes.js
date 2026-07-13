import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clinicWhere, handleScopeError, requireActiveClinic, selectedClinicId } from "../clinicScope.js";

export const productRoutes = Router();

productRoutes.use(requireAuth);

function serializeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    quantity: product.quantity,
    minStock: product.minStock,
    purchasePrice: Number(product.purchasePrice),
    salePrice: Number(product.salePrice),
    status: product.status,
    createdAt: product.createdAt
    ,clinicId: product.clinicId
    ,clinicName: product.clinic?.name || ""
  };
}

function normalizeProductInput(body) {
  return {
    name: String(body?.name || "").trim(),
    quantity: Number(body?.quantity || 0),
    minStock: Number(body?.minStock ?? 5),
    purchasePrice: Number(body?.purchasePrice || 0),
    salePrice: Number(body?.salePrice || 0)
  };
}

function isValidProductInput(input) {
  return Boolean(input.name)
    && Number.isInteger(input.quantity)
    && input.quantity >= 0
    && Number.isInteger(input.minStock)
    && input.minStock >= 0
    && Number.isFinite(input.purchasePrice)
    && input.purchasePrice >= 0
    && Number.isFinite(input.salePrice)
    && input.salePrice >= 0;
}

productRoutes.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const stock = String(req.query.stock || "").trim();

    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(status ? { status } : {}),
        ...(stock === "in_stock" ? { quantity: { gt: 0 } } : {}),
        ...clinicWhere(req)
      },
      include: { clinic: true },
      orderBy: [{ name: "asc" }, { id: "asc" }]
    });

    const filtered = stock === "min_stock"
      ? products.filter((product) => product.quantity <= product.minStock)
      : products;

    return res.json({ products: filtered.map(serializeProduct) });
  } catch (error) {
    next(error);
  }
});

productRoutes.post("/", async (req, res, next) => {
  try {
    const input = normalizeProductInput(req.body);
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    if (!isValidProductInput(input)) {
      return res.status(400).json({ error: "Informe nome, quantidades e preços válidos para o produto." });
    }

    const product = await prisma.product.create({ data: { ...input, clinicId }, include: { clinic: true } });
    return res.status(201).json({ product: serializeProduct(product) });
  } catch (error) {
    next(error);
  }
});

productRoutes.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = normalizeProductInput(req.body);
    if (!Number.isInteger(id) || !isValidProductInput(input)) {
      return res.status(400).json({ error: "Produto inválido." });
    }

    const product = await prisma.product.update({
      where: { id, deletedAt: null, ...clinicWhere(req) },
      data: input,
      include: { clinic: true }
    });
    return res.json({ product: serializeProduct(product) });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Produto não encontrado." });
    }
    next(error);
  }
});

productRoutes.patch("/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || "").trim();
    if (!Number.isInteger(id) || !["Ativo", "Inativo"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const product = await prisma.product.update({ where: { id, deletedAt: null, ...clinicWhere(req) }, data: { status }, include: { clinic: true } });
    return res.json({ product: serializeProduct(product) });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Produto não encontrado." });
    }
    next(error);
  }
});

productRoutes.post("/bulk-delete", async (req, res, next) => {
  try {
    const ids = (req.body?.ids || []).map(Number).filter(Number.isInteger);
    if (!ids.length) {
      return res.status(400).json({ error: "Selecione pelo menos um produto." });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: ids }, deletedAt: null, ...clinicWhere(req) },
      data: { deletedAt: new Date(), status: "Inativo" }
    });
    return res.json({ deletedCount: result.count });
  } catch (error) {
    next(error);
  }
});

productRoutes.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Produto inválido." });
    }

    const result = await prisma.product.updateMany({
      where: { id, deletedAt: null, ...clinicWhere(req) },
      data: { deletedAt: new Date(), status: "Inativo" }
    });
    if (!result.count) return res.status(404).json({ error: "Produto não encontrado." });
    return res.status(204).send();
  } catch (error) { handleScopeError(error, res, next); }
});
