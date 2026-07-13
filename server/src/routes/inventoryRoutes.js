import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clinicWhere, requireActiveClinic, selectedClinicId } from "../clinicScope.js";

export const inventoryRoutes = Router();
inventoryRoutes.use(requireAuth);

const MOVEMENT_TYPES = new Set(["RECEIPT", "REMOVAL", "SALE", "PLAN_CONSUMPTION", "ADJUSTMENT"]);
const movementLabels = {
  RECEIPT: "Entrada",
  REMOVAL: "Saída",
  SALE: "Venda",
  PLAN_CONSUMPTION: "Consumo por plano",
  ADJUSTMENT: "Ajuste manual"
};

const inventoryInclude = {
  product: { select: { id: true, name: true } },
  lot: {
    select: {
      id: true,
      batchNumber: true,
      expiresAt: true,
      supplier: { select: { id: true, name: true } }
    }
  },
  user: { select: { id: true, firstName: true, username: true } },
  patient: { select: { id: true, name: true } },
  patientPlan: { select: { id: true, name: true } }
};

function serializeSupplier(supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    contact: supplier.contact,
    phone: supplier.phone,
    email: supplier.email,
    notes: supplier.notes,
    clinicId: supplier.clinicId,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt
  };
}

function serializeLot(lot) {
  return {
    id: lot.id,
    productId: lot.productId,
    productName: lot.product?.name || "",
    clinicId: lot.clinicId,
    supplierId: lot.supplierId,
    supplierName: lot.supplier?.name || "",
    batchNumber: lot.batchNumber,
    expiresAt: lot.expiresAt,
    quantity: lot.quantity,
    createdAt: lot.createdAt,
    updatedAt: lot.updatedAt
  };
}

function serializeMovement(movement) {
  return {
    id: movement.id,
    productId: movement.productId,
    productName: movement.product?.name || "",
    clinicId: movement.clinicId,
    lotId: movement.lotId,
    batchNumber: movement.lot?.batchNumber || "",
    supplierName: movement.lot?.supplier?.name || "",
    type: movement.type,
    typeLabel: movementLabels[movement.type] || movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    userName: movement.user?.firstName || movement.user?.username || "",
    patientId: movement.patientId,
    patientName: movement.patient?.name || "",
    patientPlanId: movement.patientPlanId,
    patientPlanName: movement.patientPlan?.name || "",
    createdAt: movement.createdAt
  };
}

function normalizeSupplier(body) {
  return {
    name: String(body?.name || "").trim(),
    contact: String(body?.contact || "").trim(),
    phone: String(body?.phone || "").trim(),
    email: String(body?.email || "").trim().toLowerCase(),
    notes: String(body?.notes || "").trim()
  };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeNewProduct(body) {
  return {
    name: String(body?.name || "").trim(),
    quantity: 0,
    minStock: Number(body?.minStock ?? 5),
    purchasePrice: Number(body?.purchasePrice),
    salePrice: Number(body?.salePrice)
  };
}

function isValidNewProduct(product) {
  return Boolean(product.name)
    && Number.isInteger(product.minStock)
    && product.minStock >= 0
    && Number.isFinite(product.purchasePrice)
    && product.purchasePrice >= 0
    && Number.isFinite(product.salePrice)
    && product.salePrice >= 0;
}

async function scopedProduct(req, productId, clinicId) {
  const product = await prisma.product.findFirst({ where: { id: productId, clinicId, deletedAt: null } });
  if (!product) {
    const error = new Error("Produto não encontrado.");
    error.statusCode = 404;
    throw error;
  }
  return product;
}

async function scopedLot(req, lotId, clinicId) {
  const lot = await prisma.stockLot.findFirst({ where: { id: lotId, clinicId }, include: { product: true } });
  if (!lot) {
    const error = new Error("Lote não encontrado.");
    error.statusCode = 404;
    throw error;
  }
  return lot;
}

async function scopedPatientPlan(patientPlanId, clinicId, patientId) {
  if (!patientPlanId) return null;
  const plan = await prisma.patientPlan.findFirst({ where: { id: patientPlanId, clinicId } });
  if (!plan || (patientId && plan.patientId !== patientId)) {
    const error = new Error("Plano do paciente não encontrado.");
    error.statusCode = 404;
    throw error;
  }
  return plan;
}

inventoryRoutes.get("/suppliers", async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ where: clinicWhere(req), orderBy: [{ name: "asc" }, { id: "asc" }] });
    return res.json({ suppliers: suppliers.map(serializeSupplier) });
  } catch (error) { next(error); }
});

inventoryRoutes.post("/suppliers", async (req, res, next) => {
  try {
    const input = normalizeSupplier(req.body);
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    if (input.name.length < 2) return res.status(400).json({ error: "Informe o nome do fornecedor." });
    const supplier = await prisma.supplier.create({ data: { ...input, clinicId } });
    return res.status(201).json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Já existe um fornecedor com este nome." });
    next(error);
  }
});

inventoryRoutes.put("/suppliers/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = normalizeSupplier(req.body);
    if (!Number.isInteger(id) || input.name.length < 2) return res.status(400).json({ error: "Fornecedor inválido." });
    const supplier = await prisma.supplier.update({ where: { id, ...clinicWhere(req) }, data: input });
    return res.json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Já existe um fornecedor com este nome." });
    if (error.code === "P2025") return res.status(404).json({ error: "Fornecedor não encontrado." });
    next(error);
  }
});

inventoryRoutes.delete("/suppliers/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Fornecedor inválido." });
    await prisma.supplier.delete({ where: { id, ...clinicWhere(req) } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Fornecedor não encontrado." });
    next(error);
  }
});

inventoryRoutes.get("/lots", async (req, res, next) => {
  try {
    const productId = req.query.productId === undefined ? null : Number(req.query.productId);
    if (productId !== null && !Number.isInteger(productId)) return res.status(400).json({ error: "Produto inválido." });
    const lots = await prisma.stockLot.findMany({
      where: { ...(productId === null ? {} : { productId }), ...clinicWhere(req) },
      include: { product: true, supplier: true },
      orderBy: [{ expiresAt: "asc" }, { batchNumber: "asc" }]
    });
    return res.json({ lots: lots.map(serializeLot) });
  } catch (error) { next(error); }
});

inventoryRoutes.post("/lots", async (req, res, next) => {
  try {
    const requestedProductId = req.body?.productId ? Number(req.body.productId) : null;
    const newProduct = requestedProductId === null ? normalizeNewProduct(req.body?.product) : null;
    const supplierId = req.body?.supplierId ? Number(req.body.supplierId) : null;
    const batchNumber = String(req.body?.batchNumber || "").trim();
    const quantity = Number(req.body?.quantity);
    const expiresAt = parseDate(req.body?.expiresAt);
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    if ((requestedProductId === null ? !isValidNewProduct(newProduct) : !Number.isInteger(requestedProductId)) || !batchNumber || !Number.isInteger(quantity) || quantity < 1 || !expiresAt) {
      return res.status(400).json({ error: "Informe produto, lote, quantidade e uma validade válida." });
    }
    const existingProduct = requestedProductId === null ? null : await scopedProduct(req, requestedProductId, clinicId);
    if (supplierId !== null) {
      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, clinicId } });
      if (!supplier) return res.status(404).json({ error: "Fornecedor não encontrado." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = existingProduct || await tx.product.create({ data: { ...newProduct, clinicId } });
      const productId = product.id;
      const lot = await tx.stockLot.create({ data: { productId, clinicId, supplierId, batchNumber, expiresAt, quantity }, include: { product: true, supplier: true } });
      await tx.product.update({ where: { id: product.id }, data: { quantity: { increment: quantity } } });
      await tx.stockMovement.create({ data: { productId, clinicId, lotId: lot.id, userId: req.user.id, type: "RECEIPT", quantity, reason: String(req.body?.reason || "Entrada de lote").trim() } });
      return { lot, productCreated: !existingProduct };
    });
    return res.status(201).json({ lot: serializeLot(result.lot), productCreated: result.productCreated, movementType: "RECEIPT" });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Este lote já está cadastrado para o produto." });
    next(error);
  }
});

inventoryRoutes.get("/movements", async (req, res, next) => {
  try {
    const productId = req.query.productId === undefined ? null : Number(req.query.productId);
    const type = String(req.query.type || "").trim().toUpperCase();
    if (productId !== null && !Number.isInteger(productId)) return res.status(400).json({ error: "Produto inválido." });
    const movements = await prisma.stockMovement.findMany({
      where: { ...(productId === null ? {} : { productId }), ...(type ? { type } : {}), ...clinicWhere(req) },
      include: inventoryInclude,
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return res.json({ movements: movements.map(serializeMovement) });
  } catch (error) { next(error); }
});

inventoryRoutes.post("/movements", async (req, res, next) => {
  try {
    const productId = Number(req.body?.productId);
    const lotId = req.body?.lotId ? Number(req.body.lotId) : null;
    const patientId = req.body?.patientId ? Number(req.body.patientId) : null;
    const patientPlanId = req.body?.patientPlanId ? Number(req.body.patientPlanId) : null;
    const type = String(req.body?.type || "").trim().toUpperCase();
    const quantity = Number(req.body?.quantity);
    const reason = String(req.body?.reason || "").trim();
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    if (!Number.isInteger(productId) || !MOVEMENT_TYPES.has(type) || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: "Informe produto, tipo e uma quantidade válida." });
    if (["REMOVAL", "PLAN_CONSUMPTION", "ADJUSTMENT"].includes(type) && !reason) return res.status(400).json({ error: "Informe o motivo da movimentação." });
    const product = await scopedProduct(req, productId, clinicId);
    const lot = lotId === null ? null : await scopedLot(req, lotId, clinicId);
    if (lot && lot.productId !== productId) return res.status(400).json({ error: "O lote não pertence ao produto selecionado." });
    let patient = null;
    if (patientId !== null) {
      patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
      if (!patient) return res.status(404).json({ error: "Paciente não encontrado." });
    }
    const plan = await scopedPatientPlan(patientPlanId, clinicId, patientId);
    if (type === "PLAN_CONSUMPTION" && !plan) return res.status(400).json({ error: "Selecione o plano do paciente para registrar o consumo." });

    const warnings = [];
    if (type !== "RECEIPT" && product.quantity < quantity) warnings.push("A quantidade solicitada é maior que o estoque atual.");
    if (lot && lot.quantity < quantity) warnings.push("A quantidade solicitada é maior que o saldo do lote.");
    if (lot?.expiresAt && new Date(lot.expiresAt) < new Date()) warnings.push("O lote selecionado está vencido.");
    if (["SALE", "PLAN_CONSUMPTION"].includes(type) && !lot) warnings.push("Nenhum lote específico foi selecionado.");

    const movement = await prisma.$transaction(async (tx) => {
      const delta = type === "RECEIPT" ? quantity : -quantity;
      if (lot) await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: { increment: delta } } });
      await tx.product.update({ where: { id: product.id }, data: { quantity: { increment: delta } } });
      return tx.stockMovement.create({
        data: { productId, clinicId, lotId, userId: req.user.id, patientId: patient?.id || null, patientPlanId: plan?.id || null, type, quantity, reason },
        include: inventoryInclude
      });
    });
    return res.status(201).json({ movement: serializeMovement(movement), warnings });
  } catch (error) { next(error); }
});
