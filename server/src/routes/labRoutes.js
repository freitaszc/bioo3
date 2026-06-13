import { Router } from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
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
  return JSON.parse(await readFile(referencesPath, "utf8"));
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

  for (const reviewed of reviewedValues) {
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
      phone: String(reviewedPatient?.phone ?? currentPatient.phone ?? "").trim(),
      doctor: String(reviewedPatient?.doctor ?? currentPatient.doctor ?? "").trim()
    }
  };
}

labRoutes.get("/doctors", async (_req, res, next) => {
  try {
    const doctors = await prisma.doctor.findMany({ orderBy: { name: "asc" } });
    return res.json({ doctors });
  } catch (error) {
    next(error);
  }
});

labRoutes.post("/doctors", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Nome do prescritor é obrigatório." });
    }

    const doctor = await prisma.doctor.upsert({
      where: { name },
      update: { phone },
      create: { name, phone }
    });

    return res.status(201).json({ doctor });
  } catch (error) {
    next(error);
  }
});

labRoutes.post("/manual", async (req, res, next) => {
  try {
    const required = ["name", "age", "labResults"];
    const missing = required.filter((field) => !String(req.body?.[field] || "").trim());
    if (missing.length) {
      return res.status(400).json({ error: "Preencha paciente, idade e resultados laboratoriais." });
    }

    await prisma.analysisEvent.create({
      data: {
        userId: req.user.id,
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
    const extraction = await extractPdfBufferToJson(buffer, { source: filename });
    const previewId = randomUUID();

    pendingPdfAnalyses.set(previewId, {
      userId: req.user.id,
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

    if (!pending || pending.userId !== req.user.id) {
      return res.status(404).json({ error: "Prévia da análise não encontrada. Envie o PDF novamente." });
    }

    const reviewedExtraction = applyReviewedValues(
      applyReviewedPatient(pending.extraction, req.body?.patient || {}),
      req.body?.values || []
    );
    const references = await readReferences();
    const comparison = compareExtractedValuesToReferences(reviewedExtraction, references);
    const texts = buildAnalysisTexts(comparison);
    const patient = reviewedExtraction.patient || {};

    await prisma.analysisEvent.create({
      data: {
        userId: req.user.id,
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
          prescription: texts.prescriptionText || ""
        }
      });

      if (texts.diagnosisText || texts.prescriptionText) {
        await prisma.consultation.create({
          data: {
            patientId: createdPatient.id,
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
      prescriptionText: texts.prescriptionText
    });
  } catch (error) {
    next(error);
  }
});

labRoutes.post("/upload", async (_req, res) => {
  return res.status(410).json({
    error: "Use /api/lab/upload/preview para extrair os dados e /api/lab/upload/confirm para confirmar a análise."
  });
});
