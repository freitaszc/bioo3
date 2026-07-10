import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compareExtractedValuesToReferences } from "./pdfAnalysis.js";

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
