import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import { prisma } from "../prisma.js";
import {
  buildAnalysisTexts,
  compareExtractedValuesToReferences,
  extractPdfToJson,
  normalizeText,
  parseIdealRange
} from "./pdfAnalysis.js";
import { createStorageKey, getObjectBuffer, putObject } from "./objectStorage.js";
import { generateAnalysisReport, reportFileName } from "./reportPdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const referencesPath = path.resolve(__dirname, "../data/references.json");
export const BATCH_TEST_NAMES = ["Vitamina B12", "25-hidroxi D3"];
export const CONFLICT_RAW_VALUE_PREFIX = "__BATCH_CONFLICT__:";
const MAX_PATIENTS = 50;
const BATCH_TRANSACTION_TIMEOUT_MS = 60_000;
const RETENTION_DAYS = 90;

export function expiresAtFromNow() {
  return new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function readBatchReferences(db = prisma) {
  const all = JSON.parse(await readFile(referencesPath, "utf8"));
  const overrides = await db.referenceOverride.findMany({ where: { testName: { in: BATCH_TEST_NAMES } } });
  for (const override of overrides) if (all[override.testName]) all[override.testName].ideal = override.ideal;
  return Object.fromEntries(BATCH_TEST_NAMES.map((name) => [name, all[name]]));
}

function normalizedCpf(value) {
  return String(value || "").replace(/\D/g, "");
}

export function patientIdentity(patient = {}) {
  const cpf = normalizedCpf(patient.cpf);
  if (cpf) return `cpf:${cpf}`;
  const name = normalizeText(patient.name);
  return name ? `name:${name}` : "";
}

function joinMessages(messages) {
  return [...new Set(messages.filter(Boolean))].join(" ");
}

function firstPresent(values) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function numericValues(values) {
  return values.filter((value) => Number.isFinite(value));
}

function normalizedConflictValue(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return String(numeric);
  return String(value || "").trim();
}

function conflictRawValue(values) {
  return `${CONFLICT_RAW_VALUE_PREFIX}${JSON.stringify(values)}`;
}

export function conflictingValuesFromRawValue(rawValue = "") {
  if (!String(rawValue).startsWith(CONFLICT_RAW_VALUE_PREFIX)) return [];
  try {
    const parsed = JSON.parse(String(rawValue).slice(CONFLICT_RAW_VALUE_PREFIX.length));
    return Array.isArray(parsed) ? parsed.map((value) => String(value).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function conflictWarning(testName, values) {
  return `Mais de um valor foi encontrado para ${testName} (${values.join(", ")}). Revise e selecione o valor a ser considerado.`;
}

export function classifyValue(value, ideal) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "MISSING";
  const { min, max } = parseIdealRange(ideal);
  if (min === null || max === null) return "MISSING";
  if (Number(value) < min) return "LOW";
  if (Number(value) > max) return "HIGH";
  return "NORMAL";
}

function unitForTest(testName) {
  return testName === "Vitamina B12" ? "pg/mL" : "ng/mL";
}

export function deriveAnalysisTexts(patient, resultValues, references) {
  const extraction = { patient, values: {} };
  for (const result of resultValues) {
    if (result.value === null || !Number.isFinite(Number(result.value))) continue;
    extraction.values[result.testName] = {
      testName: result.testName,
      value: Number(result.value),
      rawValue: String(result.value),
      sourceLine: "",
      lineNumber: 0
    };
  }
  const comparison = compareExtractedValuesToReferences(extraction, references);
  const texts = buildAnalysisTexts(comparison);
  return {
    ...texts,
    hasAlteration: resultValues.some((result) => ["LOW", "HIGH"].includes(classifyValue(result.value, references[result.testName].ideal)))
  };
}

async function pdfPages(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => ({ number: page.num, text: page.text || "" }));
  } finally {
    await parser.destroy();
  }
}

export async function segmentPdfBuffer(buffer, references) {
  const pages = await pdfPages(buffer);
  const pageInfo = [];
  for (const page of pages) {
    const extraction = await extractPdfToJson(`page-${page.number}.pdf`, { references, text: page.text });
    pageInfo.push({
      ...page,
      extraction,
      identity: patientIdentity(extraction.patient),
      patientMarkers: (page.text.match(/paciente\s*:/gi) || []).length
    });
  }

  const segments = [];
  for (const page of pageInfo) {
    const current = segments.at(-1);
    const mustSplit = !current || (page.identity && current.identity && page.identity !== current.identity);
    if (mustSplit) {
      segments.push({
        identity: page.identity,
        pages: [page],
        error: page.patientMarkers > 1 ? "Mais de um paciente foi detectado na mesma página." : ""
      });
    } else {
      current.pages.push(page);
      if (page.patientMarkers > 1) current.error = "Mais de um paciente foi detectado na mesma página.";
      if (!current.identity && page.identity) current.identity = page.identity;
    }
  }

  const analyzed = [];
  for (const segment of segments) {
    const text = segment.pages.map((page) => page.text).join("\n");
    const extraction = await extractPdfToJson("segment.pdf", { references, text });
    analyzed.push({
      identity: patientIdentity(extraction.patient),
      pageStart: segment.pages[0].number,
      pageEnd: segment.pages.at(-1).number,
      patient: extraction.patient,
      values: extraction.values,
      error: segment.error
    });
  }
  return { pageCount: pages.length, segments: analyzed };
}

function matchPatient(patient, patients) {
  const cpf = normalizedCpf(patient.cpf);
  const name = normalizeText(patient.name);
  const matches = cpf
    ? patients.filter((candidate) => normalizedCpf(candidate.cpf) === cpf)
    : patients.filter((candidate) => name && normalizeText(candidate.name) === name);
  if (matches.length === 1) return { status: "MATCHED", patientId: matches[0].id };
  if (matches.length > 1) return { status: "AMBIGUOUS", patientId: null };
  return { status: patient.name && patient.age ? "NEW" : "NEEDS_REVIEW", patientId: null };
}

function segmentResults(segment, references) {
  return BATCH_TEST_NAMES.map((testName) => {
    const value = segment.values[testName]?.value;
    return {
      testName,
      value: Number.isFinite(Number(value)) ? Number(value) : null,
      rawValue: segment.values[testName]?.rawValue || "",
      unit: unitForTest(testName),
      ideal: String(references[testName].ideal),
      status: classifyValue(value, references[testName].ideal)
    };
  });
}

export function mergeBatchCandidates(candidates) {
  const groups = [];
  const grouped = new Map();
  for (const candidate of candidates) {
    if (!candidate.identity) {
      groups.push([candidate]);
      continue;
    }
    if (!grouped.has(candidate.identity)) {
      const list = [];
      grouped.set(candidate.identity, list);
      groups.push(list);
    }
    grouped.get(candidate.identity).push(candidate);
  }

  return groups.map((group) => {
    if (group.length === 1) return group[0];
    const [first] = group;
    const pageStarts = numericValues(group.map((candidate) => candidate.pageStart));
    const pageEnds = numericValues(group.map((candidate) => candidate.pageEnd));
    const mergedPatient = {
      name: firstPresent(group.map((candidate) => candidate.patient?.name)) || "",
      age: firstPresent(group.map((candidate) => candidate.patient?.age)) || "",
      cpf: firstPresent(group.map((candidate) => candidate.patient?.cpf)) || "",
      gender: firstPresent(group.map((candidate) => candidate.patient?.gender)) || ""
    };
    const mergedValues = {};
    const warnings = [];

    for (const testName of BATCH_TEST_NAMES) {
      const matches = group
        .map((candidate) => candidate.values?.[testName])
        .filter(Boolean);
      if (!matches.length) continue;

      const byValue = new Map();
      for (const match of matches) {
        const displayValue = normalizedConflictValue(match.rawValue ?? match.value);
        if (!displayValue) continue;
        if (!byValue.has(displayValue)) byValue.set(displayValue, match);
      }

      if (byValue.size > 1) {
        const values = [...byValue.keys()];
        warnings.push(conflictWarning(testName, values));
        mergedValues[testName] = {
          ...matches[0],
          value: null,
          rawValue: conflictRawValue(values)
        };
        continue;
      }

      const [selected] = byValue.values();
      mergedValues[testName] = selected || matches[0];
    }

    return {
      ...first,
      pageStart: pageStarts.length ? Math.min(...pageStarts) : first.pageStart,
      pageEnd: pageEnds.length ? Math.max(...pageEnds) : first.pageEnd,
      patient: mergedPatient,
      values: mergedValues,
      error: joinMessages([
        ...group.map((candidate) => candidate.error),
        ...warnings
      ])
    };
  });
}

export async function processBatch(batchId) {
  const claimed = await prisma.analysisBatch.updateMany({
    where: { id: batchId, status: "QUEUED" },
    data: { status: "PROCESSING", error: "" }
  });
  if (!claimed.count) return;

  try {
    const batch = await prisma.analysisBatch.findUnique({ where: { id: batchId }, include: { sourceFiles: true } });
    const references = await readBatchReferences();
    const patients = await prisma.patient.findMany({ where: { clinicId: batch.clinicId } });
    const candidates = [];

    for (const sourceFile of batch.sourceFiles) {
      const buffer = await getObjectBuffer(sourceFile.storageKey);
      const parsed = await segmentPdfBuffer(buffer, references);
      await prisma.analysisSourceFile.update({ where: { id: sourceFile.id }, data: { pageCount: parsed.pageCount } });
      for (const segment of parsed.segments) candidates.push({ ...segment, sourceFileId: sourceFile.id });
    }

    const mergedCandidates = mergeBatchCandidates(candidates);
    if (!mergedCandidates.length) throw new Error("Nenhum paciente foi identificado nos PDFs.");
    if (mergedCandidates.length > MAX_PATIENTS) throw new Error(`O lote contém ${mergedCandidates.length} pacientes; o limite é ${MAX_PATIENTS}.`);

    await prisma.$transaction(async (tx) => {
      await tx.labAnalysis.deleteMany({ where: { batchId } });
      for (const candidate of mergedCandidates) {
        const matching = matchPatient(candidate.patient, patients);
        const results = segmentResults(candidate, references);
        const texts = deriveAnalysisTexts(candidate.patient, results, references);
        const hasConflictingValues = results.some((result) => result.value === null && conflictingValuesFromRawValue(result.rawValue).length > 1);
        const error = joinMessages([
          candidate.error,
          matching.status === "AMBIGUOUS" ? "Mais de um paciente cadastrado corresponde aos dados extraídos." : "",
          !candidate.patient.name ? "Nome do paciente não identificado." : "",
          !candidate.patient.age ? "Idade do paciente não identificada." : "",
          results.every((result) => result.status === "MISSING") && !hasConflictingValues ? "B12 e D3 não foram encontrados." : ""
        ]);

        await tx.labAnalysis.create({
          data: {
            batchId,
            sourceFileId: candidate.sourceFileId,
            patientId: matching.patientId,
            pageStart: candidate.pageStart,
            pageEnd: candidate.pageEnd,
            patientName: candidate.patient.name || "",
            patientAge: Number(candidate.patient.age) || 0,
            patientCpf: candidate.patient.cpf || "",
            patientGender: candidate.patient.gender || "",
            matchingStatus: matching.status,
            status: "DRAFT",
            diagnosisText: texts.diagnosisText,
            prescriptionText: texts.prescriptionText,
            hasAlteration: texts.hasAlteration,
            error,
            results: { create: results }
          }
        });
      }
      await tx.analysisBatch.update({
        where: { id: batchId },
        data: { status: "REVIEW", candidateCount: mergedCandidates.length, processedCount: mergedCandidates.length, error: "" }
      });
    }, { maxWait: 10_000, timeout: BATCH_TRANSACTION_TIMEOUT_MS });
  } catch (error) {
    await prisma.analysisBatch.update({
      where: { id: batchId },
      data: { status: "FAILED", error: String(error?.message || error).slice(0, 1500) }
    });
  }
}

export async function recalculateAnalysis(analysisId, db = prisma) {
  const analysis = await db.labAnalysis.findUnique({ where: { id: analysisId }, include: { results: true } });
  const references = await readBatchReferences(db);
  const patient = {
    name: analysis.patientName,
    age: analysis.patientAge,
    cpf: analysis.patientCpf,
    gender: analysis.patientGender
  };
  const results = analysis.results.map((result) => ({
    ...result,
    status: classifyValue(result.value, references[result.testName].ideal),
    ideal: String(references[result.testName].ideal)
  }));
  const texts = deriveAnalysisTexts(patient, results, references);
  for (const result of results) {
    await db.labResult.update({ where: { id: result.id }, data: { status: result.status, ideal: result.ideal } });
  }
  return db.labAnalysis.update({
    where: { id: analysisId },
    data: {
      diagnosisText: texts.diagnosisText,
      prescriptionText: texts.prescriptionText,
      hasAlteration: texts.hasAlteration
    }
  });
}

export async function generateReportForAnalysis(analysisId) {
  let analysis = await prisma.labAnalysis.findUnique({
    where: { id: analysisId },
    include: { results: { orderBy: { testName: "asc" } }, batch: { include: { clinic: true, doctor: true } }, documents: true }
  });
  if (!analysis || !["CONFIRMED", "READY", "REPORT_FAILED"].includes(analysis.status)) return null;
  const existing = analysis.documents.find((document) => document.kind === "REPORT" && !document.purgedAt && document.expiresAt > new Date());
  if (existing) return existing;
  const claimed = await prisma.labAnalysis.updateMany({
    where: { id: analysisId, status: { in: ["CONFIRMED", "REPORT_FAILED"] } },
    data: { status: "REPORTING" }
  });
  if (!claimed.count) return null;
  analysis = await prisma.labAnalysis.findUnique({
    where: { id: analysisId },
    include: { results: { orderBy: { testName: "asc" } }, batch: { include: { clinic: true, doctor: true } }, documents: true }
  });
  try {
    const buffer = await generateAnalysisReport(analysis);
    const fileName = reportFileName(analysis.patientName);
    const storageKey = createStorageKey(`reports/${analysis.batchId}`);
    await putObject({ key: storageKey, buffer });
    const document = await prisma.analysisDocument.upsert({
      where: { analysisId_kind: { analysisId, kind: "REPORT" } },
      update: { fileName, storageKey, size: buffer.length, expiresAt: expiresAtFromNow(), purgedAt: null },
      create: { analysisId, kind: "REPORT", fileName, storageKey, size: buffer.length, expiresAt: expiresAtFromNow() }
    });
    await prisma.labAnalysis.update({ where: { id: analysisId }, data: { status: "READY", error: "" } });
    return document;
  } catch (error) {
    await prisma.labAnalysis.update({
      where: { id: analysisId },
      data: { status: "REPORT_FAILED", error: String(error?.message || error).slice(0, 1000) }
    });
    throw error;
  }
}

export async function generateReportsForBatch(batchId) {
  const analyses = await prisma.labAnalysis.findMany({ where: { batchId, status: "CONFIRMED" } });
  for (const analysis of analyses) {
    try {
      await generateReportForAnalysis(analysis.id);
    } catch {
      // The row carries its own retryable REPORT_FAILED state.
    }
  }
}
