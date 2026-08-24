import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import PDFDocument from "pdfkit";
import {
  BATCH_TEST_NAMES,
  classifyValue,
  deriveAnalysisTexts,
  segmentPdfBuffer
} from "./batchAnalysis.js";

const references = JSON.parse(
  await readFile(new URL("../data/references.json", import.meta.url), "utf8")
);
const batchReferences = Object.fromEntries(BATCH_TEST_NAMES.map((name) => [name, references[name]]));

function syntheticPdf(patients) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const document = new PDFDocument({ size: "A4", margin: 40 });
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    patients.forEach((patient, index) => {
      if (index) document.addPage();
      document.fontSize(12).text(`Paciente: ${patient.name} Idade: ${patient.age} anos`);
      document.moveDown().text("VITAMINA B12 Valor de referência");
      document.text(`Resultado: ${patient.b12} pg/mL`);
      document.moveDown().text("VITAMINA D - 25 HIDROXI Valor de referência");
      document.text(`Resultado: ${patient.d3} ng/mL`);
    });
    document.end();
  });
}

test("segments one consolidated PDF into one candidate per patient", async () => {
  const buffer = await syntheticPdf([
    { name: "Paciente Anônimo Um", age: 41, b12: 300, d3: 40 },
    { name: "Paciente Anônimo Dois", age: 52, b12: 700, d3: 75 },
    { name: "Paciente Anônimo Três", age: 63, b12: 950, d3: 110 }
  ]);
  const parsed = await segmentPdfBuffer(buffer, batchReferences);
  assert.equal(parsed.pageCount, 3);
  assert.equal(parsed.segments.length, 3);
  assert.deepEqual(parsed.segments.map((segment) => Object.keys(segment.values).sort()), [
    ["25-hidroxi D3", "Vitamina B12"],
    ["25-hidroxi D3", "Vitamina B12"],
    ["25-hidroxi D3", "Vitamina B12"]
  ]);
});

test("classifies missing, low, normal and high batch values", () => {
  assert.equal(classifyValue(null, "500-900 ng/L"), "MISSING");
  assert.equal(classifyValue(499, "500-900 ng/L"), "LOW");
  assert.equal(classifyValue(500, "500-900 ng/L"), "NORMAL");
  assert.equal(classifyValue(901, "500-900 ng/L"), "HIGH");
});

test("batch prescription uses only the configured ADEK and B12 suggestions", () => {
  const result = deriveAnalysisTexts({ name: "Paciente Anônimo", age: 40 }, [
    { testName: "Vitamina B12", value: 200 },
    { testName: "25-hidroxi D3", value: 20 }
  ], batchReferences);
  assert.equal(result.hasAlteration, true);
  assert.match(result.prescriptionText, /B12 2\.500mg/);
  assert.match(result.prescriptionText, /ADEK2 600\.000 UI/);
  assert.doesNotMatch(result.prescriptionText, /Moreflex|Trio Metilador|Vitamina D3/);
});
