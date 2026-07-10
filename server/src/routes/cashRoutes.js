import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clinicWhere, requireActiveClinic, selectedClinicId } from "../clinicScope.js";

export const cashRoutes = Router();
cashRoutes.use(requireAuth);

const SOURCES = new Set(["MANUAL", "PLAN"]);
const PAYMENT_METHODS = new Set(["CASH", "PIX", "CARD", "TRANSFER", "OTHER"]);

const saleInclude = {
  clinic: { select: { id: true, name: true } },
  patient: { select: { id: true, name: true } },
  patientPlan: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, username: true } },
  items: { include: { product: { select: { id: true, name: true } } }, orderBy: { id: "asc" } },
  installmentRows: { include: { payments: true }, orderBy: { number: "asc" } },
  payments: { orderBy: { receivedAt: "desc" } }
};

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function money(value) {
  return Number(value || 0);
}

function distribute(totalCents, count) {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

function saleWhere(req, id) {
  const clinicId = selectedClinicId(req);
  return { ...(id === undefined ? {} : { id }), ...(clinicId ? { clinicId } : {}) };
}

function serializeSale(sale) {
  const paidAmount = (sale.payments || []).reduce((sum, payment) => sum + money(payment.amount), 0);
  return {
    id: sale.id,
    clinicId: sale.clinicId,
    clinicName: sale.clinic?.name || "",
    patientId: sale.patientId,
    patientName: sale.patient?.name || "",
    patientPlanId: sale.patientPlanId,
    patientPlanName: sale.patientPlan?.name || "",
    createdByName: sale.createdBy?.firstName || sale.createdBy?.username || "",
    source: sale.source,
    status: sale.status,
    subtotal: money(sale.subtotal),
    discountPercent: money(sale.discountPercent),
    discountAmount: money(sale.discountAmount),
    total: money(sale.total),
    paidAmount,
    balance: Math.max(0, money(sale.total) - paidAmount),
    installments: sale.installments,
    items: (sale.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      total: money(item.total)
    })),
    installmentRows: (sale.installmentRows || []).map((row) => ({
      id: row.id,
      number: row.number,
      amount: money(row.amount),
      dueDate: row.dueDate,
      status: row.status,
      paidAmount: (row.payments || []).reduce((sum, payment) => sum + money(payment.amount), 0)
    })),
    payments: (sale.payments || []).map((payment) => ({
      id: payment.id,
      installmentId: payment.installmentId,
      amount: money(payment.amount),
      method: payment.method,
      notes: payment.notes,
      receivedAt: payment.receivedAt
    })),
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt
  };
}

async function findPatient(req, patientId, clinicId) {
  if (!patientId) return null;
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
  if (!patient) return null;
  return patient;
}

cashRoutes.get("/sales", async (req, res, next) => {
  try {
    const status = String(req.query.status || "").trim().toUpperCase();
    const sales = await prisma.sale.findMany({
      where: { ...saleWhere(req), ...(status ? { status } : {}) },
      include: saleInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    return res.json({ sales: sales.map(serializeSale) });
  } catch (error) { next(error); }
});

cashRoutes.get("/sales/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Venda inválida." });
    const sale = await prisma.sale.findFirst({ where: saleWhere(req, id), include: saleInclude });
    if (!sale) return res.status(404).json({ error: "Venda não encontrada." });
    return res.json({ sale: serializeSale(sale) });
  } catch (error) { next(error); }
});

cashRoutes.post("/sales", async (req, res, next) => {
  try {
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    const source = String(req.body?.source || "MANUAL").trim().toUpperCase();
    const patientId = req.body?.patientId ? Number(req.body.patientId) : null;
    const patientPlanId = req.body?.patientPlanId ? Number(req.body.patientPlanId) : null;
    const discountPercent = Number(req.body?.discountPercent || 0);
    const installments = Number(req.body?.installments || 1);
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!SOURCES.has(source) || !Number.isInteger(installments) || installments < 1 || installments > 60) return res.status(400).json({ error: "Informe uma origem e quantidade de parcelas válidas." });
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return res.status(400).json({ error: "O desconto deve estar entre 0% e 100%." });
    if (patientId !== null && !Number.isInteger(patientId)) return res.status(400).json({ error: "Paciente inválido." });
    if (patientPlanId !== null && !Number.isInteger(patientPlanId)) return res.status(400).json({ error: "Plano inválido." });
    if (!rawItems.length) return res.status(400).json({ error: "Adicione pelo menos um produto à venda." });

    const patient = await findPatient(req, patientId, clinicId);
    if (patientId && !patient) return res.status(404).json({ error: "Paciente não encontrado." });
    let plan = null;
    if (patientPlanId) {
      plan = await prisma.patientPlan.findFirst({ where: { id: patientPlanId, clinicId } });
      if (!plan || (patientId && plan.patientId !== patientId)) return res.status(404).json({ error: "Plano do paciente não encontrado." });
    }
    if (source === "PLAN" && !plan) return res.status(400).json({ error: "Selecione o plano que originou a venda." });

    const productIds = rawItems.map((item) => Number(item?.productId));
    if (productIds.some((id) => !Number.isInteger(id))) return res.status(400).json({ error: "Produto inválido." });
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, clinicId } });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const items = rawItems.map((item) => {
      const product = productMap.get(Number(item.productId));
      const quantity = Number(item.quantity);
      return { product, quantity };
    });
    if (items.some((item) => !item.product)) return res.status(404).json({ error: "Um ou mais produtos não foram encontrados." });
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return res.status(400).json({ error: "A quantidade dos produtos deve ser maior que zero." });

    const warnings = [];
    for (const item of items) if (item.product.quantity < item.quantity) warnings.push(`${item.product.name}: quantidade acima do estoque atual.`);
    const subtotalCents = items.reduce((sum, item) => sum + cents(item.product.salePrice) * item.quantity, 0);
    const discountCents = Math.round(subtotalCents * discountPercent / 100);
    const totalCents = subtotalCents - discountCents;
    const installmentAmounts = distribute(totalCents, installments);

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          clinicId,
          patientId: patient?.id || plan?.patientId || null,
          patientPlanId: plan?.id || null,
          createdById: req.user.id,
          source,
          subtotal: subtotalCents / 100,
          discountPercent,
          discountAmount: discountCents / 100,
          total: totalCents / 100,
          installments,
          items: { create: items.map((item) => ({ productId: item.product.id, productName: item.product.name, quantity: item.quantity, unitPrice: Number(item.product.salePrice), total: cents(item.product.salePrice) * item.quantity / 100 })) },
          installmentRows: { create: installmentAmounts.map((amount, index) => ({ number: index + 1, amount })) }
        },
        include: saleInclude
      });
      for (const item of items) {
        await tx.product.update({ where: { id: item.product.id }, data: { quantity: { decrement: item.quantity } } });
        await tx.stockMovement.create({ data: { productId: item.product.id, clinicId, userId: req.user.id, patientId: created.patientId, patientPlanId: created.patientPlanId, saleId: created.id, type: "SALE", quantity: item.quantity, reason: `Venda #${created.id}` } });
      }
      return created;
    });
    return res.status(201).json({ sale: serializeSale(sale), warnings });
  } catch (error) { next(error); }
});

cashRoutes.post("/sales/:id/payments", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || "").trim().toUpperCase();
    const installmentId = req.body?.installmentId ? Number(req.body.installmentId) : null;
    if (!Number.isInteger(id) || !Number.isFinite(amount) || amount <= 0 || !PAYMENT_METHODS.has(method)) return res.status(400).json({ error: "Informe valor e método de pagamento válidos." });
    const sale = await prisma.sale.findFirst({ where: saleWhere(req, id), include: { installmentRows: { include: { payments: true } }, payments: true } });
    if (!sale) return res.status(404).json({ error: "Venda não encontrada." });
    if (sale.status === "CANCELED" || sale.status === "PAID") return res.status(409).json({ error: "Esta venda não aceita novos pagamentos." });
    const paymentCents = cents(amount);
    const paidCents = sale.payments.reduce((sum, payment) => sum + cents(payment.amount), 0);
    const totalCents = cents(sale.total);
    if (paidCents + paymentCents > totalCents) return res.status(400).json({ error: "O pagamento excede o saldo da venda." });
    let selectedInstallmentId = installmentId;
    if (selectedInstallmentId) {
      const installment = sale.installmentRows.find((row) => row.id === selectedInstallmentId);
      if (!installment) return res.status(404).json({ error: "Parcela não encontrada." });
      const installmentPaidCents = installment.payments.reduce((sum, payment) => sum + cents(payment.amount), 0);
      if (installmentPaidCents + paymentCents > cents(installment.amount)) return res.status(400).json({ error: "O pagamento excede o saldo da parcela." });
    } else {
      selectedInstallmentId = sale.installmentRows.find((row) => row.status !== "PAID")?.id || null;
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: { saleId: id, installmentId: selectedInstallmentId, clinicId: sale.clinicId, userId: req.user.id, amount, method, notes: String(req.body?.notes || "").trim() } });
      const allPayments = await tx.payment.findMany({ where: { saleId: id } });
      for (const row of sale.installmentRows) {
        const rowPaid = allPayments.filter((payment) => payment.installmentId === row.id).reduce((sum, payment) => sum + cents(payment.amount), 0);
        await tx.installment.update({ where: { id: row.id }, data: { status: rowPaid >= cents(row.amount) ? "PAID" : rowPaid > 0 ? "PARTIAL" : "PENDING" } });
      }
      const newPaidCents = allPayments.reduce((sum, payment) => sum + cents(payment.amount), 0);
      await tx.sale.update({ where: { id }, data: { status: newPaidCents >= totalCents ? "PAID" : "PARTIAL" } });
      return tx.sale.findUnique({ where: { id }, include: saleInclude });
    });
    return res.status(201).json({ sale: serializeSale(updatedSale) });
  } catch (error) { next(error); }
});
