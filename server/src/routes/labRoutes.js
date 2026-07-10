import { Router } from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clinicWhere, requireActiveClinic, requireAdmin, selectedClinicId } from "../clinicScope.js";
import { councilType as sanitizeCouncilType, digitsOnly, uppercaseText, validPhone } from "../inputSanitizers.js";
import {
  buildAnalysisTexts,
  compareExtractedValuesToReferences,
  extractPdfBufferToJson
} from "../services/pdfAnalysis.js";

export const labRoutes = Router();
const pendingPdfAnalyses = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const referencesPath = path.resolve(__dirname, "../data/references.json");

labRoutes.use(requireAuth);

async function readReferences() {
  const references = JSON.parse(await readFile(referencesPath, "utf8"));
  const overrides = await prisma.referenceOverride.findMany();
  for (const override of overrides) {
    if (references[override.testName]) references[override.testName].ideal = override.ideal;
  }
  return references;
}

function getPdfBufferFromBody(body) {
  const filename = String(body?.filename || "uploaded.pdf").trim();
  const data = String(body?.data || "").trim();
  const base64 = data.includes(",") ? data.split(",").pop() : data;

  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new Error("Envie um arquivo PDF.");
  }

  if (!base64) {
    throw new Error("Arquivo PDF não enviado.");
  }

  return {
    filename,
    buffer: Buffer.from(base64, "base64")
  };
}

function previewPayload(previewId, extraction) {
  const values = Object.values(extraction.values || {})
    .sort((a, b) => a.testName.localeCompare(b.testName, "pt-BR"))
    .map((value) => ({
      testName: value.testName,
      value: value.value,
      rawValue: value.rawValue,
      parser: value.parser,
      sourceLine: value.sourceLine,
      lineNumber: value.lineNumber
    }));

  return {
    previewId,
    patient: extraction.patient,
    stats: extraction.stats,
    values
  };
}

function applyReviewedValues(extraction, reviewedValues = []) {
  const nextExtraction = {
    ...extraction,
    values: { ...(extraction.values || {}) }
  };

  const reviewedByTestName = new Map(
    reviewedValues
      .map((reviewed) => [String(reviewed?.testName || "").trim(), reviewed])
      .filter(([testName]) => testName)
  );

  for (const testName of Object.keys(nextExtraction.values)) {
    if (!reviewedByTestName.has(testName)) delete nextExtraction.values[testName];
  }

  for (const reviewed of reviewedByTestName.values()) {
    const testName = String(reviewed?.testName || "").trim();
    const value = Number(reviewed?.value);
    if (!testName || !Number.isFinite(value) || !nextExtraction.values[testName]) continue;

    nextExtraction.values[testName] = {
      ...nextExtraction.values[testName],
      value,
      rawValue: String(reviewed.value),
      reviewed: true
    };
  }

  return nextExtraction;
}

function applyReviewedPatient(extraction, reviewedPatient = {}) {
  const currentPatient = extraction.patient || {};
  const age = Number(reviewedPatient?.age ?? currentPatient.age ?? 0);

  return {
    ...extraction,
    patient: {
      ...currentPatient,
      name: String(reviewedPatient?.name ?? currentPatient.name ?? "").trim(),
      age: Number.isFinite(age) ? age : 0,
      gender: String(reviewedPatient?.gender ?? currentPatient.gender ?? "").trim(),
      cpf: String(reviewedPatient?.cpf ?? currentPatient.cpf ?? "").trim(),
      phone: digitsOnly(reviewedPatient?.phone ?? currentPatient.phone, 11),
      doctor: String(reviewedPatient?.doctor ?? currentPatient.doctor ?? "").trim()
    }
  };
}

labRoutes.get("/doctors", async (req, res, next) => {
  try {
    const doctors = await prisma.doctor.findMany({ where: clinicWhere(req), include: { clinic: true }, orderBy: { name: "asc" } });
    return res.json({ doctors });
  } catch (error) {
    next(error);
  }
});

labRoutes.get("/references", async (req, res, next) => {
  try {
    const base = JSON.parse(await readFile(referencesPath, "utf8"));
    const effective = await readReferences();
    const references = Object.keys(base).sort((a, b) => a.localeCompare(b, "pt-BR")).map((testName) => ({
      testName,
      ideal: typeof effective[testName].ideal === "string" ? effective[testName].ideal : JSON.stringify(effective[testName].ideal),
      defaultIdeal: typeof base[testName].ideal === "string" ? base[testName].ideal : JSON.stringify(base[testName].ideal)
    }));
    return res.json({ references });
  } catch (error) { next(error); }
});

labRoutes.put("/references/:testName", requireAdmin, async (req, res, next) => {
  try {
    const testName = decodeURIComponent(req.params.testName);
    const ideal = String(req.body?.ideal || "").trim();
    const base = JSON.parse(await readFile(referencesPath, "utf8"));
    if (!base[testName]) return res.status(404).json({ error: "Referência não encontrada." });
    if (!ideal) return res.status(400).json({ error: "Informe o valor ideal." });
    const reference = await prisma.referenceOverride.upsert({
      where: { testName }, update: { ideal }, create: { testName, ideal }
    });
    return res.json({ reference });
  } catch (error) { next(error); }
});

labRoutes.post("/doctors", async (req, res, next) => {
  try {
    const name = uppercaseText(req.body?.name);
    const phone = digitsOnly(req.body?.phone, 11);
    const councilType = sanitizeCouncilType(req.body?.councilType);
    const councilNumber = digitsOnly(req.body?.councilNumber, 12);
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);

    if (name.length < 2 || !validPhone(phone) || councilType.length < 2 || councilNumber.length < 3) {
      return res.status(400).json({ error: "Informe nome, telefone com 10 ou 11 dígitos, tipo de conselho e número do conselho." });
    }

    const doctor = await prisma.doctor.upsert({
      where: { clinicId_name: { clinicId, name } },
      update: { phone, councilType, councilNumber },
      create: { name, phone, councilType, councilNumber, clinicId }
    });

    return res.status(201).json({ doctor });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Já existe um prescritor com este nome." });
    next(error);
  }
});

labRoutes.put("/doctors/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = uppercaseText(req.body?.name);
    const phone = digitsOnly(req.body?.phone, 11);
    const councilType = sanitizeCouncilType(req.body?.councilType);
    const councilNumber = digitsOnly(req.body?.councilNumber, 12);
    if (!Number.isInteger(id) || name.length < 2 || !validPhone(phone) || councilType.length < 2 || councilNumber.length < 3) {
      return res.status(400).json({ error: "Preencha corretamente todos os campos do prescritor." });
    }
    const doctor = await prisma.doctor.update({ where: { id, ...clinicWhere(req) }, data: { name, phone, councilType, councilNumber } });
    return res.json({ doctor });
  } catch (error) { if (error.code === "P2025") return res.status(404).json({ error: "Prescritor não encontrado." }); if (error.code === "P2002") return res.status(409).json({ error: "Já existe um prescritor com este nome." }); next(error); }
});

labRoutes.delete("/doctors/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Prescritor inválido." });
    const result = await prisma.doctor.deleteMany({ where: { id, ...clinicWhere(req) } });
    if (!result.count) return res.status(404).json({ error: "Prescritor não encontrado." });
    return res.status(204).send();
  } catch (error) { next(error); }
});

labRoutes.post("/manual", async (req, res, next) => {
  try {
    const required = ["name", "age", "labResults"];
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    const missing = required.filter((field) => !String(req.body?.[field] || "").trim());
    if (missing.length) {
      return res.status(400).json({ error: "Preencha paciente, idade e resultados laboratoriais." });
    }

    await prisma.analysisEvent.create({
      data: {
        userId: req.user.id,
        clinicId,
        source: "manual"
      }
    });

    return res.status(202).json({
      status: "pending_ai",
      message: "Entrada manual recebida. A análise por IA será conectada na próxima etapa."
    });
  } catch (error) {
    next(error);
  }
});

labRoutes.post("/upload/preview", async (req, res, next) => {
  try {
    const { filename, buffer } = getPdfBufferFromBody(req.body);
    const clinicId = selectedClinicId(req, { required: true });
    await requireActiveClinic(prisma, clinicId);
    const references = await readReferences();
    const extraction = await extractPdfBufferToJson(buffer, { source: filename, references });
    const previewId = randomUUID();

    pendingPdfAnalyses.set(previewId, {
      userId: req.user.id,
      clinicId,
      filename,
      extraction,
      createdAt: Date.now()
    });

    return res.status(200).json(previewPayload(previewId, extraction));
  } catch (error) {
    if (error.message?.includes("PDF") || error.message?.includes("Arquivo")) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

labRoutes.post("/upload/confirm", async (req, res, next) => {
  try {
    const previewId = String(req.body?.previewId || "").trim();
    const pending = pendingPdfAnalyses.get(previewId);
    const clinicId = selectedClinicId(req, { required: true });
    const doctorId = Number(req.body?.doctorId);

    if (!pending || pending.userId !== req.user.id || pending.clinicId !== clinicId) {
      return res.status(404).json({ error: "Prévia da análise não encontrada. Envie o PDF novamente." });
    }
    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId } });
    if (!doctor || !doctor.councilType || !doctor.councilNumber) return res.status(400).json({ error: "Selecione um prescritor com CR cadastrado." });

    const reviewedExtraction = applyReviewedValues(
      applyReviewedPatient(pending.extraction, req.body?.patient || {}),
      req.body?.values || []
    );
    const references = await readReferences();
    const comparison = compareExtractedValuesToReferences(reviewedExtraction, references);
    const texts = buildAnalysisTexts(comparison);
    const patient = reviewedExtraction.patient || {};
    if (patient.phone && !validPhone(patient.phone)) return res.status(400).json({ error: "O telefone do paciente deve ter 10 ou 11 dígitos." });
    let createdPatientId = null;

    await prisma.analysisEvent.create({
      data: {
        userId: req.user.id,
        clinicId: pending.clinicId,
        source: "pdf"
      }
    });

    if (patient.name && patient.age) {
      const createdPatient = await prisma.patient.create({
        data: {
          name: patient.name,
          age: Number(patient.age),
          cpf: patient.cpf || "",
          gender: patient.gender || "",
          phone: patient.phone || "",
          prescription: texts.prescriptionText || "",
          clinicId: pending.clinicId,
          doctorId: doctor.id
        }
      });
      createdPatientId = createdPatient.id;

      if (texts.diagnosisText || texts.prescriptionText) {
        await prisma.consultation.create({
          data: {
            patientId: createdPatient.id,
            clinicId: pending.clinicId,
            notes: `Diagnóstico:\n${texts.diagnosisText}\n\nPrescrição:\n${texts.prescriptionText}`.trim()
          }
        });
      }
    }

    pendingPdfAnalyses.delete(previewId);

    return res.status(200).json({
      status: "completed",
      message: "Análise confirmada.",
      patient,
      extraction: previewPayload(previewId, reviewedExtraction),
      comparison,
      diagnosisText: texts.diagnosisText,
      prescriptionText: texts.prescriptionText,
      doctor,
      patientId: createdPatientId
    });
  } catch (error) {
    next(error);
  }
});

labRoutes.patch("/patients/:id/prescription", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const prescription = String(req.body?.prescription || "").trim();
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Paciente inválido." });
    const patient = await prisma.patient.update({ where: { id, ...clinicWhere(req) }, data: { prescription } });
    return res.json({ patient });
  } catch (error) { if (error.code === "P2025") return res.status(404).json({ error: "Paciente não encontrado." }); next(error); }
});

labRoutes.post("/upload", async (_req, res) => {
  return res.status(410).json({
    error: "Use /api/lab/upload/preview para extrair os dados e /api/lab/upload/confirm para confirmar a análise."
  });
});
