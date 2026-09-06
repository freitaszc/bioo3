import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildAnalysisTexts, compareExtractedValuesToReferences } from "./pdfAnalysis.js";

const references = JSON.parse(
  await readFile(new URL("../data/references.json", import.meta.url), "utf8")
);

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
