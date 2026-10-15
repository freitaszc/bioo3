import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import PDFDocument from "pdfkit";
import { PDFParse } from "pdf-parse";
import { buildAnalysisTexts, compareExtractedValuesToReferences, extractPdfToJson, extractPdfBufferToJson, readPdfBufferText } from "./pdfAnalysis.js";
import { segmentPdfBuffer } from "./batchAnalysis.js";

const references = JSON.parse(
  await readFile(new URL("../data/references.json", import.meta.url), "utf8")
);

// De-identified assay lines from the supplied scan, including actual OCR noise.
const scannedAssays = `Vitamina D-25 Hidroxi
Data de Coleta....................... 05/10/2026 08:18
Material biológico: SORO Método: QUIMIOLUMINESCÊNCIA
Resultado.....iisssiiiiiiie eee 23,3 ng/mL Valores de Referencia
Deficiência: Inferior a 20,0 ng/mL
Valores normais: Entre 20,0 e 60,0 ng/mL
Vitamina B12
Data de Coleta....................... 05/10/2026 08:18
Material biológico: SORO Método: Quimioluminescência
Valores Referenciais
ResultadoO.....iisscciiiiieieees 356 pg/mL 0-2anos Vide Nota
19 anos e acima Normal: 180 a 914 pg/mL`;

function assertVitaminValues(extraction) {
  assert.equal(extraction.values["25-hidroxi D3"]?.value, 23.3);
  assert.equal(extraction.values["Vitamina B12"]?.value, 356);
  const comparison = compareExtractedValuesToReferences(extraction, references);
  assert.equal(comparison.results.find((r) => r.testName === "25-hidroxi D3")?.value, 23.3);
  assert.equal(comparison.results.find((r) => r.testName === "Vitamina B12")?.value, 356);
  const texts = buildAnalysisTexts(comparison);
  assert.match(texts.diagnosisText, /25-hidroxi D3: valor 23\.3/);
  assert.match(texts.diagnosisText, /Vitamina B12: valor 356/);
}

test("extracts the BIOCELL scan's values despite OCR leader noise", async () => {
  assertVitaminValues(await extractPdfToJson("scan.pdf", { text: scannedAssays, references }));
});

test("keeps existing inline and block templates working", async () => {
  for (const text of [
    "Vitamina D-25 Hidroxi: 23,3 ng/mL\nVitamina B12: 356 pg/mL",
    "VITAMINA D - 25 HIDROXI\nResultado: 23,3 ng/mL\nVITAMINA B12\nResultado: 356 pg/mL"
  ]) assertVitaminValues(await extractPdfToJson("existing.pdf", { text, references }));
});

test("does not mistake dates, reference ranges or the next assay for a result", async () => {
  const text = `Vitamina D-25 Hidroxi
Data de Coleta: 05/10/2026
Valores normais: Entre 20,0 e 60,0 ng/mL
Vitamina B12
Resultado: 356 pg/mL`;
  const extraction = await extractPdfToJson("missing.pdf", { text, references });
  assert.equal(extraction.values["25-hidroxi D3"], undefined);
  assert.equal(extraction.values["Vitamina B12"].value, 356);
  const empty = await extractPdfToJson("does-not-exist.pdf", { text: "", references });
  assert.deepEqual(empty.values, {});
});

function makePdf(draw) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    draw(document);
    document.end();
  });
}

test("automatically recognizes image-only pages in single and batch uploads", async () => {
  const searchable = await makePdf((doc) => {
    doc.fontSize(16).text("Paciente: Pessoa Teste Idade: 40 anos");
    doc.moveDown().text("Vitamina D-25 Hidroxi");
    doc.text("Resultado: 23,3 ng/mL");
    doc.moveDown().text("Vitamina B12");
    doc.text("Resultado: 356 pg/mL");
  });
  const parser = new PDFParse({ data: searchable });
  let image;
  try {
    image = (await parser.getScreenshot({ desiredWidth: 1800 })).pages[0].data;
  } finally {
    await parser.destroy();
  }
  const scan = await makePdf((doc) => doc.image(image, 0, 0, { width: 595.28 }));
  const scanText = await readPdfBufferText(scan);
  assert.match(scanText, /23[,\.]3/, scanText);
  assertVitaminValues(await extractPdfBufferToJson(scan, { references, text: scanText }));
  const batch = await segmentPdfBuffer(scan, references);
  assert.equal(batch.segments.length, 1);
  assertVitaminValues(batch.segments[0]);
});

// Run against the private original without committing patient data to the repo:
// PDF_ANALYSIS_SAMPLE='/path/to/report.pdf' npm test
test("supplied scanned PDF end-to-end", { skip: !process.env.PDF_ANALYSIS_SAMPLE }, async () => {
  const buffer = await readFile(process.env.PDF_ANALYSIS_SAMPLE);
  assertVitaminValues(await extractPdfBufferToJson(buffer, { references }));
  const batch = await segmentPdfBuffer(buffer, references);
  assert.equal(batch.pageCount, 1);
  assertVitaminValues(batch.segments[0]);
});

function statusFor(value) {
  const comparison = compareExtractedValuesToReferences({
    patient: {},
    values: {
      "25-hidroxi D3": { testName: "25-hidroxi D3", value }
    }
  }, references);
  return comparison.results[0]?.status;
}

test("25-hidroxi D3 uses 60-100 ng/mL as its ideal range", () => {
  assert.equal(statusFor(59.9), "low");
  assert.equal(statusFor(60), "normal");
  assert.equal(statusFor(100), "normal");
  assert.equal(statusFor(100.1), "high");
});

function analyze(value, age = 40, refs = references) {
  const comparison = compareExtractedValuesToReferences({
    patient: { age },
    values: value === undefined ? {} : { "Vitamina B12": { value } }
  }, refs);
  return { comparison, ...buildAnalysisTexts(comparison) };
}

test("B12 schedule follows the requested threshold, including exact boundaries", () => {
  for (const value of [0, 100, 199.9]) {
    assert.match(analyze(value).prescriptionText, /1 dose 1x por semana por 2 semanas/);
  }
  for (const value of [200, 300, 399.9]) {
    assert.match(analyze(value).prescriptionText, /dose única/);
  }
  for (const value of [400, 500, 900, 901, undefined, NaN, -1]) {
    assert.equal(analyze(value).prescriptionText, "");
  }
  assert.equal(references["Vitamina B12"].medications.low[0].aplicacao, "Aplicar dose única (IM).");
});

test("B12 scheduling stays at 400 when the diagnostic reference is customized", () => {
  const refs = { ...references, "Vitamina B12": { ...references["Vitamina B12"], ideal: "500-900" } };
  assert.equal(analyze(450, 40, refs).comparison.results[0].status, "low");
  assert.equal(analyze(450, 40, refs).prescriptionText, "");
});

test("analysis warns for known minors, including without laboratory results", () => {
  for (const age of [1, 17, "17"]) {
    assert.match(analyze(undefined, age).diagnosisText, /^Atenção: paciente menor de 18 anos\./);
  }
  // Existing records use zero for an unidentified age.
  for (const age of [18, 40, 0, null, "", "inválida", -1]) {
    assert.doesNotMatch(analyze(200, age).diagnosisText, /menor de 18/);
  }
});
