import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REFERENCES_PATH = path.resolve(__dirname, "../data/references.json");

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s%./,<>:=+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function parseNumericValue(rawValue) {
  if (!rawValue) return null;
  const cleaned = String(rawValue).replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }

  if (hasComma) {
    return Number(cleaned.replace(",", "."));
  }

  if (hasDot) {
    const dotParts = cleaned.split(".");
    const lastPart = dotParts.at(-1);
    if (dotParts.length > 1 && lastPart?.length === 3) {
      return Number(cleaned.replace(/\./g, ""));
    }
  }

  return Number(cleaned);
}

export function parseIdealRange(idealText) {
  const text = String(idealText || "").split("\n")[0].trim();
  const normalized = normalizeText(text);

  const greaterMatch = normalized.match(/(?:>=|>|maior que|superior a|minimo|minima)\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (greaterMatch) {
    return { min: parseNumericValue(greaterMatch[1]), max: Infinity };
  }

  const lowerMatch = normalized.match(/(?:<=|<|menor que|inferior a|maximo|maxima|ate)\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (lowerMatch) {
    return { min: -Infinity, max: parseNumericValue(lowerMatch[1]) };
  }

  const rangeMatch = normalized.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:-|–|a)\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (rangeMatch) {
    return {
      min: parseNumericValue(rangeMatch[1]),
      max: parseNumericValue(rangeMatch[2])
    };
  }

  const exactMatch = normalized.match(/([0-9]+(?:[.,][0-9]+)?)/);
  if (exactMatch) {
    const value = parseNumericValue(exactMatch[1]);
    return { min: value, max: value };
  }

  return { min: null, max: null };
}

async function readReferences(referencesPath = DEFAULT_REFERENCES_PATH) {
  const raw = await readFile(referencesPath, "utf8");
  return JSON.parse(raw);
}

export async function readPdfText(pdfPath) {
  const data = await readFile(pdfPath);
  return readPdfBufferText(data);
}

export async function readPdfBufferText(data) {
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

function buildReferenceMatchers(references) {
  return Object.entries(references).map(([name, info]) => {
    const aliases = [...new Set([name, ...asArray(info.synonyms)].map(normalizeText).filter(Boolean))];
    return { name, info, aliases };
  });
}

function getCandidateLines(lines, alias) {
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizeText(line);
    if (!normalizedLine.includes(alias)) continue;

    candidates.push({
      line,
      lineNumber: index + 1,
      window: [line, lines[index + 1] || "", lines[index + 2] || ""].filter(Boolean).join(" ")
    });
  }
  return candidates;
}

function extractValueFromCandidate(candidate, alias) {
  const normalizedWindow = normalizeText(candidate.window);
  const aliasIndex = normalizedWindow.indexOf(alias);
  if (aliasIndex === -1) return null;

  const afterAlias = normalizedWindow.slice(aliasIndex + alias.length);
  const valueMatch = afterAlias.match(/[:=]?\s*(?:resultado|valor)?\s*[:=]?\s*([<>]?\s*-?\d{1,6}(?:[.,]\d{1,4})?)/);
  if (!valueMatch) return null;

  const rawValue = valueMatch[1];
  const value = parseNumericValue(rawValue);
  if (!Number.isFinite(value)) return null;

  return {
    value,
    rawValue: rawValue.replace(/\s+/g, ""),
    line: candidate.line,
    lineNumber: candidate.lineNumber
  };
}

function chooseBestValue(lines, matcher) {
  for (const alias of matcher.aliases) {
    const candidates = getCandidateLines(lines, alias);
    for (const candidate of candidates) {
      const value = extractValueFromCandidate(candidate, alias);
      if (value) {
        return { ...value, matchedAlias: alias };
      }
    }
  }

  return null;
}

function extractPatientInfo(text, lines) {
  const joined = text.replace(/\s+/g, " ");
  const cpf = joined.match(/CPF\s*[:\s]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)?.[1] || "";
  const gender = joined.match(/Sexo\s*[:\s]?\s*([MF])/i)?.[1] || "";
  const age = Number(joined.match(/(?:Idade\s*[:\s]?\s*)?(\d{1,3})\s*(?:anos|a\b)/i)?.[1] || 0);
  const doctor = lines.find((line) => /m[eé]dico|dr\.?|dra\.?/i.test(line)) || "";

  let name = "";
  const patientLine = lines.find((line) => /paciente\s*:/i.test(line));
  if (patientLine) {
    name = patientLine.replace(/.*paciente\s*:\s*/i, "").replace(/\s+idade.*$/i, "").trim();
  }

  if (!name) {
    const birthDateLine = lines.find((line) => /\d{2}\/\d{2}\/\d{4}\s*\(\d+\s*anos?\)/i.test(line));
    if (birthDateLine) {
      name = birthDateLine.replace(/\d{2}\/\d{2}\/\d{4}.*/i, "").trim();
    }
  }

  return {
    name: name ? name.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "",
    gender,
    age: Number.isFinite(age) ? age : 0,
    cpf,
    phone: "",
    doctor
  };
}

export async function extractPdfToJson(pdfPath, options = {}) {
  const references = options.references || await readReferences(options.referencesPath);
  const rawText = options.text || await readPdfText(pdfPath);
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matchers = buildReferenceMatchers(references);
  const values = {};

  for (const matcher of matchers) {
    const match = chooseBestValue(lines, matcher);
    if (!match) continue;

    values[matcher.name] = {
      testName: matcher.name,
      value: match.value,
      rawValue: match.rawValue,
      matchedAlias: match.matchedAlias,
      sourceLine: match.line,
      lineNumber: match.lineNumber
    };
  }

  return {
    source: pdfPath,
    extractedAt: new Date().toISOString(),
    patient: extractPatientInfo(rawText, lines),
    stats: {
      pagesTextLength: rawText.length,
      lineCount: lines.length,
      extractedCount: Object.keys(values).length,
      referenceCount: matchers.length
    },
    values
  };
}

export async function extractPdfBufferToJson(buffer, options = {}) {
  const references = options.references || await readReferences(options.referencesPath);
  const rawText = options.text || await readPdfBufferText(buffer);
  return extractPdfToJson(options.source || "uploaded.pdf", { ...options, references, text: rawText });
}

function getIdealForPatient(referenceInfo, patient = {}) {
  const ideal = referenceInfo?.ideal;
  if (ideal && typeof ideal === "object" && !Array.isArray(ideal)) {
    return ideal[patient.gender] || ideal.M || ideal.F || Object.values(ideal)[0] || "";
  }
  return ideal || "";
}

function getMedicationList(referenceInfo, direction) {
  const value = referenceInfo?.medications?.[direction];
  return Array.isArray(value) ? value : [];
}

export function compareExtractedValuesToReferences(extraction, references) {
  const results = [];
  const prescriptions = new Map();

  for (const [testName, extracted] of Object.entries(extraction.values || {})) {
    const reference = references[testName];
    if (!reference) continue;

    const ideal = getIdealForPatient(reference, extraction.patient);
    const { min, max } = parseIdealRange(ideal);
    let status = "unknown";
    let medications = [];

    if (min !== null && max !== null) {
      if (extracted.value < min) {
        status = "low";
        medications = getMedicationList(reference, "low");
      } else if (extracted.value > max) {
        status = "high";
        medications = getMedicationList(reference, "high");
      } else {
        status = "normal";
      }
    }

    for (const medication of medications) {
      if (medication?.nome && !prescriptions.has(medication.nome)) {
        prescriptions.set(medication.nome, medication);
      }
    }

    results.push({
      testName,
      value: extracted.value,
      rawValue: extracted.rawValue,
      ideal,
      status,
      sourceLine: extracted.sourceLine,
      lineNumber: extracted.lineNumber,
      matchedAlias: extracted.matchedAlias,
      medications
    });
  }

  results.sort((a, b) => a.testName.localeCompare(b.testName, "pt-BR"));

  return {
    results,
    summary: {
      totalExtracted: results.length,
      normal: results.filter((result) => result.status === "normal").length,
      low: results.filter((result) => result.status === "low").length,
      high: results.filter((result) => result.status === "high").length,
      unknown: results.filter((result) => result.status === "unknown").length
    },
    prescriptions: [...prescriptions.values()]
  };
}

export function buildAnalysisTexts(comparison) {
  const diagnosisGroups = {
    high: [],
    low: [],
    normal: [],
    unknown: []
  };
  const prescriptionLines = [];
  const seenPrescriptions = new Set();

  for (const result of comparison.results || []) {
    if (result.status === "low") {
      diagnosisGroups.low.push(`${result.testName}: valor ${result.value} ABAIXO do valor ideal (${result.ideal}).`);
    } else if (result.status === "high") {
      diagnosisGroups.high.push(`${result.testName}: valor ${result.value} ACIMA do valor ideal (${result.ideal}).`);
    } else if (result.status === "normal") {
      diagnosisGroups.normal.push(`${result.testName}: valor ${result.value} está dentro do valor ideal (${result.ideal}).`);
    } else {
      diagnosisGroups.unknown.push(`${result.testName}: valor ${result.value} sem faixa ideal interpretável (${result.ideal || "sem referência"}).`);
    }
  }

  for (const prescription of comparison.prescriptions || []) {
    if (!prescription?.nome || seenPrescriptions.has(prescription.nome)) continue;
    seenPrescriptions.add(prescription.nome);
    prescriptionLines.push(
      `- ${prescription.nome}\nPreparo: ${prescription.preparo || ""}\nAplicação: ${prescription.aplicacao || ""}`
    );
  }

  const diagnosisSections = [
    ["Valores acima", diagnosisGroups.high],
    ["Valores abaixo", diagnosisGroups.low],
    ["Valores normais", diagnosisGroups.normal],
    ["Sem classificação", diagnosisGroups.unknown]
  ]
    .filter(([, lines]) => lines.length)
    .map(([title, lines]) => `${title}\n${lines.join("\n")}`);

  return {
    diagnosisText: diagnosisSections.join("\n\n"),
    prescriptionText: prescriptionLines.join("\n\n")
  };
}

export function compareExtractionToExpected(extraction, expectedValues, options = {}) {
  const tolerance = Number(options.tolerance ?? 0.01);
  const expectedEntries = Object.entries(expectedValues || {});
  const results = expectedEntries.map(([testName, expectedValue]) => {
    const extracted = extraction.values?.[testName];
    const expectedNumber = Number(expectedValue);
    const extractedNumber = Number(extracted?.value);
    const matched = Number.isFinite(expectedNumber)
      && Number.isFinite(extractedNumber)
      && Math.abs(extractedNumber - expectedNumber) <= tolerance;

    return {
      testName,
      expected: expectedNumber,
      extracted: Number.isFinite(extractedNumber) ? extractedNumber : null,
      matched,
      delta: Number.isFinite(extractedNumber) ? Number((extractedNumber - expectedNumber).toFixed(4)) : null,
      sourceLine: extracted?.sourceLine || null
    };
  });

  return {
    results,
    summary: {
      expectedCount: expectedEntries.length,
      matched: results.filter((result) => result.matched).length,
      missing: results.filter((result) => result.extracted === null).length,
      mismatched: results.filter((result) => result.extracted !== null && !result.matched).length,
      accuracy: expectedEntries.length
        ? Number((results.filter((result) => result.matched).length / expectedEntries.length).toFixed(3))
        : 0
    }
  };
}

export async function testPdfAnalysis(pdfPath, options = {}) {
  const references = await readReferences(options.referencesPath);
  const extraction = await extractPdfToJson(pdfPath, { ...options, references });
  const comparison = compareExtractedValuesToReferences(extraction, references);
  const matchedReferenceNames = new Set(Object.keys(extraction.values || {}));
  const unmatchedReferences = Object.keys(references).filter((name) => !matchedReferenceNames.has(name));
  const expectedComparison = options.expectedValues
    ? compareExtractionToExpected(extraction, options.expectedValues, options)
    : null;

  return {
    extraction,
    comparison,
    expectedComparison,
    quality: {
      textLength: extraction.stats.pagesTextLength,
      lineCount: extraction.stats.lineCount,
      referenceCount: extraction.stats.referenceCount,
      extractedCount: extraction.stats.extractedCount,
      extractionRate: extraction.stats.referenceCount
        ? Number((extraction.stats.extractedCount / extraction.stats.referenceCount).toFixed(3))
        : 0,
      likelyScannedPdf: extraction.stats.pagesTextLength < 200,
      unmatchedReferences
    }
  };
}
