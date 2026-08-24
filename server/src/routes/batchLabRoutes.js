import { randomUUID } from "node:crypto";
import multer from "multer";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { clinicWhere, requireActiveClinic, selectedClinicId } from "../clinicScope.js";
import { normalizeWhatsAppPhone, validWhatsAppPhone } from "../inputSanitizers.js";
import {
  BATCH_TEST_NAMES,
  classifyValue,
  expiresAtFromNow,
  generateReportForAnalysis,
  generateReportsForBatch,
  patientIdentity,
  readBatchReferences,
  recalculateAnalysis
} from "../services/batchAnalysis.js";
import { createStorageKey, deleteObject, getObjectBuffer, putObject, signedDownloadUrl } from "../services/objectStorage.js";
import { runBackgroundCycle } from "../services/backgroundWorker.js";
import { getWhatsAppConnection } from "../services/whatsapp.js";

export const batchLabRoutes = Router();
const MAX_BATCH_BYTES = 100 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 50, fileSize: MAX_BATCH_BYTES },
  fileFilter(_req, file, callback) {
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    callback(isPdf ? null : new Error("Todos os arquivos devem ser PDFs."), isPdf);
  }
});

const batchInclude = {
  clinic: { select: { id: true, name: true, whatsappPhone: true, status: true } },
  doctor: { select: { id: true, name: true, councilType: true, councilNumber: true } },
  sourceFiles: { orderBy: { createdAt: "asc" } },
  analyses: {
    orderBy: { createdAt: "asc" },
    include: {
      results: { orderBy: { testName: "asc" } },
      documents: true,
      whatsappDelivery: true
    }
  }
};

function serializeBatch(batch) {
  const sourceById = new Map((batch.sourceFiles || []).map((file) => [file.id, file]));
  return {
    ...batch,
    sourceFiles: (batch.sourceFiles || []).map((file) => ({
      ...file,
      originalUrl: !file.purgedAt && file.expiresAt > new Date()
        ? `/api/lab/batches/${batch.id}/files/${file.id}`
        : null
    })),
    analyses: (batch.analyses || []).map((analysis) => {
      const report = analysis.documents?.find((document) => document.kind === "REPORT");
      const source = sourceById.get(analysis.sourceFileId);
      return {
        ...analysis,
        originalUrl: source && !source.purgedAt && source.expiresAt > new Date()
          ? `/api/lab/batches/${batch.id}/files/${analysis.sourceFileId}`
          : null,
        reportUrl: report && !report.purgedAt && report.expiresAt > new Date()
          ? `/api/lab/analyses/${analysis.id}/report`
          : null
      };
    })
  };
}

function scopedBatchWhere(req, id) {
  return { id, ...clinicWhere(req) };
}

function cleanFileName(value) {
  return String(value || "exame.pdf").replace(/[\r\n"/\\]/g, "-").slice(0, 180);
}

batchLabRoutes.post("/batches", upload.array("files", 50), async (req, res, next) => {
  const storedKeys = [];
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "Selecione pelo menos um PDF." });
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_BYTES) {
      return res.status(413).json({ error: "O lote não pode ultrapassar 100 MB." });
    }
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    const doctorId = Number(req.body?.doctorId);
    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId } });
    if (!doctor || !doctor.councilType || !doctor.councilNumber) {
      return res.status(400).json({ error: "Selecione um prescritor da clínica com conselho cadastrado." });
    }

    const batchId = randomUUID();
    const sourceFiles = [];
    for (const file of files) {
      const storageKey = createStorageKey(`originals/${batchId}`);
      await putObject({ key: storageKey, buffer: file.buffer });
      storedKeys.push(storageKey);
      sourceFiles.push({
        fileName: cleanFileName(file.originalname),
        storageKey,
        size: file.size,
        expiresAt: expiresAtFromNow()
      });
    }

    const batch = await prisma.analysisBatch.create({
      data: {
        id: batchId,
        clinicId,
        doctorId,
        createdById: req.user.id,
        status: "QUEUED",
        sourceFiles: { create: sourceFiles }
      },
      include: batchInclude
    });
    setImmediate(() => runBackgroundCycle().catch(console.error));
    return res.status(202).json({ batch: serializeBatch(batch) });
  } catch (error) {
    await Promise.allSettled(storedKeys.map((key) => deleteObject(key)));
    next(error);
  }
});

batchLabRoutes.get("/batches", async (req, res, next) => {
  try {
    const batches = await prisma.analysisBatch.findMany({
      where: clinicWhere(req),
      include: batchInclude,
      orderBy: { createdAt: "desc" },
      take: 30
    });
    return res.json({ batches: batches.map(serializeBatch) });
  } catch (error) {
    next(error);
  }
});

batchLabRoutes.get("/batches/:id", async (req, res, next) => {
  try {
    const batch = await prisma.analysisBatch.findFirst({ where: scopedBatchWhere(req, req.params.id), include: batchInclude });
    if (!batch) return res.status(404).json({ error: "Lote não encontrado." });
    return res.json({ batch: serializeBatch(batch) });
  } catch (error) {
    next(error);
  }
});

function normalizePatientInput(body, current) {
  const patient = body?.patient || {};
  const age = Number(patient.age ?? current.patientAge);
  return {
    patientName: String(patient.name ?? current.patientName).trim().replace(/\s+/g, " "),
    patientAge: Number.isInteger(age) && age > 0 && age <= 130 ? age : 0,
    patientCpf: String(patient.cpf ?? current.patientCpf).replace(/\D/g, "").slice(0, 11),
    patientGender: String(patient.gender ?? current.patientGender).trim().slice(0, 20)
  };
}

async function resolveMatching(clinicId, patient) {
  const identity = patientIdentity({ name: patient.patientName, cpf: patient.patientCpf });
  if (!identity) return { matchingStatus: "NEEDS_REVIEW", patientId: null };
  const candidates = await prisma.patient.findMany({ where: { clinicId }, select: { id: true, name: true, cpf: true } });
  const matches = candidates.filter((candidate) => patientIdentity(candidate) === identity);
  if (matches.length === 1) return { matchingStatus: "MATCHED", patientId: matches[0].id };
  if (matches.length > 1) return { matchingStatus: "AMBIGUOUS", patientId: null };
  return { matchingStatus: patient.patientName && patient.patientAge ? "NEW" : "NEEDS_REVIEW", patientId: null };
}

batchLabRoutes.patch("/batches/:batchId/analyses/:analysisId", async (req, res, next) => {
  try {
    const analysis = await prisma.labAnalysis.findFirst({
      where: { id: req.params.analysisId, batch: scopedBatchWhere(req, req.params.batchId) },
      include: { batch: true, results: true }
    });
    if (!analysis) return res.status(404).json({ error: "Análise não encontrada." });
    if (analysis.batch.status !== "REVIEW") return res.status(409).json({ error: "Este lote não está mais em revisão." });

    if (req.body?.excluded === true) {
      const excluded = await prisma.labAnalysis.update({ where: { id: analysis.id }, data: { status: "EXCLUDED", error: "" }, include: { results: true, documents: true, whatsappDelivery: true } });
      return res.json({ analysis: excluded });
    }

    const patient = normalizePatientInput(req.body, analysis);
    const matching = await resolveMatching(analysis.batch.clinicId, patient);
    const supplied = new Map((req.body?.values || []).map((result) => [String(result.testName), result.value]));
    const references = await readBatchReferences();
    for (const result of analysis.results) {
      if (!supplied.has(result.testName)) continue;
      const raw = supplied.get(result.testName);
      const number = raw === "" || raw === null ? null : Number(raw);
      if (number !== null && !Number.isFinite(number)) return res.status(400).json({ error: `Valor inválido para ${result.testName}.` });
      await prisma.labResult.update({
        where: { id: result.id },
        data: {
          value: number,
          rawValue: number === null ? "" : String(number),
          status: classifyValue(number, references[result.testName].ideal),
          edited: true
        }
      });
    }
    const refreshedResults = await prisma.labResult.findMany({ where: { analysisId: analysis.id } });
    const error = !patient.patientName
      ? "Nome do paciente não informado."
      : !patient.patientAge
        ? "Idade do paciente não informada."
        : matching.matchingStatus === "AMBIGUOUS"
          ? "Mais de um paciente cadastrado corresponde aos dados informados."
          : refreshedResults.every((result) => result.value === null)
            ? "Informe ao menos um valor de B12 ou D3."
            : "";
    await prisma.labAnalysis.update({
      where: { id: analysis.id },
      data: { ...patient, ...matching, status: "DRAFT", error }
    });
    await recalculateAnalysis(analysis.id);
    const updated = await prisma.labAnalysis.findUnique({
      where: { id: analysis.id },
      include: { results: { orderBy: { testName: "asc" } }, documents: true, whatsappDelivery: true }
    });
    return res.json({ analysis: updated });
  } catch (error) {
    next(error);
  }
});

batchLabRoutes.post("/batches/:id/confirm", async (req, res, next) => {
  try {
    const batch = await prisma.analysisBatch.findFirst({
      where: scopedBatchWhere(req, req.params.id),
      include: { analyses: { include: { results: true } } }
    });
    if (!batch) return res.status(404).json({ error: "Lote não encontrado." });
    if (batch.status !== "REVIEW") return res.status(409).json({ error: "O lote não está disponível para confirmação." });
    const analyses = batch.analyses.filter((analysis) => analysis.status !== "EXCLUDED");
    if (!analyses.length) return res.status(400).json({ error: "O lote não possui pacientes para confirmar." });

    const identities = new Set();
    for (const analysis of analyses) {
      const identity = patientIdentity({ name: analysis.patientName, cpf: analysis.patientCpf });
      if (!analysis.patientName || !analysis.patientAge || analysis.results.every((result) => result.value === null)) {
        return res.status(400).json({ error: `Revise os dados de ${analysis.patientName || "um paciente sem nome"}.` });
      }
      if (!identity || identities.has(identity)) return res.status(400).json({ error: `Há pacientes duplicados ou sem identificação única no lote.` });
      identities.add(identity);
    }

    await prisma.$transaction(async (tx) => {
      const existingPatients = await tx.patient.findMany({ where: { clinicId: batch.clinicId } });
      for (const analysis of analyses) {
        const identity = patientIdentity({ name: analysis.patientName, cpf: analysis.patientCpf });
        const matches = existingPatients.filter((patient) => patientIdentity(patient) === identity);
        if (matches.length > 1) throw Object.assign(new Error(`Há mais de um cadastro para ${analysis.patientName}.`), { statusCode: 400 });
        let patient = matches[0];
        if (!patient) {
          patient = await tx.patient.create({
            data: {
              name: analysis.patientName,
              age: analysis.patientAge,
              cpf: analysis.patientCpf,
              gender: analysis.patientGender,
              phone: "",
              prescription: analysis.prescriptionText,
              clinicId: batch.clinicId,
              doctorId: batch.doctorId
            }
          });
          existingPatients.push(patient);
        } else if (analysis.prescriptionText) {
          patient = await tx.patient.update({ where: { id: patient.id }, data: { prescription: analysis.prescriptionText } });
        }

        await tx.consultation.create({
          data: {
            patientId: patient.id,
            clinicId: batch.clinicId,
            notes: `Diagnóstico:\n${analysis.diagnosisText}\n\nPrescrição:\n${analysis.prescriptionText}`.trim()
          }
        });
        await tx.analysisEvent.create({
          data: { userId: req.user.id, patientId: patient.id, clinicId: batch.clinicId, source: "pdf_batch" }
        });
        await tx.labAnalysis.update({
          where: { id: analysis.id },
          data: { patientId: patient.id, matchingStatus: matches.length ? "MATCHED" : "CREATED", status: "CONFIRMED", confirmedAt: new Date(), error: "" }
        });
      }
      await tx.analysisBatch.update({ where: { id: batch.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), error: "" } });
    });

    setImmediate(() => generateReportsForBatch(batch.id).catch(console.error));
    const confirmed = await prisma.analysisBatch.findUnique({ where: { id: batch.id }, include: batchInclude });
    return res.json({ batch: serializeBatch(confirmed) });
  } catch (error) {
    next(error);
  }
});

async function queueAnalysisDelivery(analysisId, req) {
  let analysis = await prisma.labAnalysis.findFirst({
    where: { id: analysisId, batch: clinicWhere(req) },
    include: { batch: { include: { clinic: true } }, documents: true, whatsappDelivery: true }
  });
  if (!analysis) throw Object.assign(new Error("Análise não encontrada."), { statusCode: 404 });
  if (!analysis.hasAlteration) throw Object.assign(new Error("Somente análises com alteração podem ser enviadas."), { statusCode: 400 });
  if (analysis.status === "REPORT_FAILED") {
    await generateReportForAnalysis(analysis.id);
    analysis = await prisma.labAnalysis.findUnique({
      where: { id: analysis.id },
      include: { batch: { include: { clinic: true } }, documents: true, whatsappDelivery: true }
    });
  }
  const report = analysis.documents.find((document) => document.kind === "REPORT" && !document.purgedAt && document.expiresAt > new Date());
  if (analysis.status !== "READY" || !report) throw Object.assign(new Error("O relatório ainda não está disponível."), { statusCode: 409 });
  if (!validWhatsAppPhone(analysis.batch.clinic.whatsappPhone)) {
    throw Object.assign(new Error("A clínica não possui um WhatsApp destinatário válido."), { statusCode: 400 });
  }
  const connection = await getWhatsAppConnection();
  if (!connection || connection.status !== "CONNECTED") {
    throw Object.assign(new Error("Conecte o WhatsApp remetente antes de enviar."), { statusCode: 409 });
  }
  if (analysis.whatsappDelivery && ["QUEUED", "SENDING", "SENT", "DELIVERED", "READ"].includes(analysis.whatsappDelivery.status)) {
    return analysis.whatsappDelivery;
  }
  return prisma.whatsAppDelivery.upsert({
    where: { analysisId: analysis.id },
    update: { status: "QUEUED", lastError: "", recipientPhone: normalizeWhatsAppPhone(analysis.batch.clinic.whatsappPhone) },
    create: {
      analysisId: analysis.id,
      recipientPhone: normalizeWhatsAppPhone(analysis.batch.clinic.whatsappPhone),
      templateName: process.env.WHATSAPP_REPORT_TEMPLATE || "bioo3_relatorio_exames_v1",
      status: "QUEUED"
    }
  });
}

batchLabRoutes.post("/analyses/:id/send", async (req, res, next) => {
  try {
    const delivery = await queueAnalysisDelivery(req.params.id, req);
    setImmediate(() => runBackgroundCycle().catch(console.error));
    return res.status(202).json({ delivery });
  } catch (error) {
    next(error);
  }
});

batchLabRoutes.post("/batches/:id/send", async (req, res, next) => {
  try {
    const batch = await prisma.analysisBatch.findFirst({
      where: scopedBatchWhere(req, req.params.id),
      include: { analyses: true }
    });
    if (!batch) return res.status(404).json({ error: "Lote não encontrado." });
    const eligible = batch.analyses.filter((analysis) => analysis.hasAlteration && ["READY", "REPORT_FAILED"].includes(analysis.status));
    const deliveries = [];
    for (const analysis of eligible) deliveries.push(await queueAnalysisDelivery(analysis.id, req));
    setImmediate(() => runBackgroundCycle().catch(console.error));
    return res.status(202).json({ queued: deliveries.filter((delivery) => delivery.status === "QUEUED").length, deliveries });
  } catch (error) {
    next(error);
  }
});

async function sendStoredPdf(res, file, disposition) {
  if (!file || file.purgedAt || file.expiresAt <= new Date()) return res.status(410).json({ error: "O arquivo expirou." });
  const mode = disposition === "attachment" ? "attachment" : "inline";
  const url = await signedDownloadUrl(file.storageKey, { fileName: file.fileName, disposition: mode });
  if (url) return res.redirect(url);
  const buffer = await getObjectBuffer(file.storageKey);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${mode}; filename="${cleanFileName(file.fileName)}"`);
  return res.send(buffer);
}

batchLabRoutes.get("/batches/:batchId/files/:fileId", async (req, res, next) => {
  try {
    const file = await prisma.analysisSourceFile.findFirst({
      where: { id: req.params.fileId, batch: scopedBatchWhere(req, req.params.batchId) }
    });
    if (!file) return res.status(404).json({ error: "Arquivo original não encontrado." });
    return sendStoredPdf(res, file, req.query.disposition);
  } catch (error) {
    next(error);
  }
});

batchLabRoutes.get("/analyses/:id/report", async (req, res, next) => {
  try {
    const analysis = await prisma.labAnalysis.findFirst({ where: { id: req.params.id, batch: clinicWhere(req) } });
    if (!analysis) return res.status(404).json({ error: "Análise não encontrada." });
    const document = await prisma.analysisDocument.findUnique({ where: { analysisId_kind: { analysisId: analysis.id, kind: "REPORT" } } });
    return sendStoredPdf(res, document, req.query.disposition);
  } catch (error) {
    next(error);
  }
});
