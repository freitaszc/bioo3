import path from "node:path";
import { readFile } from "node:fs/promises";
import { testPdfAnalysis } from "../services/pdfAnalysis.js";

function printUsage() {
  console.log("Usage: npm run analysis:test -- <pdf-path> [--json] [--expected expected-values.json]");
}

function printSummary(report) {
  const { extraction, comparison, quality } = report;

  console.log(`PDF: ${extraction.source}`);
  console.log(`Patient: ${extraction.patient.name || "Not detected"}`);
  console.log(`Text length: ${quality.textLength}`);
  console.log(`Lines: ${quality.lineCount}`);
  console.log(`Extracted values: ${quality.extractedCount}/${quality.referenceCount}`);
  console.log(`Extraction rate: ${(quality.extractionRate * 100).toFixed(1)}%`);
  console.log(`Likely scanned PDF: ${quality.likelyScannedPdf ? "yes" : "no"}`);
  console.log("");
  console.log("Comparison summary:");
  console.log(`  Normal: ${comparison.summary.normal}`);
  console.log(`  Low: ${comparison.summary.low}`);
  console.log(`  High: ${comparison.summary.high}`);
  console.log(`  Unknown range: ${comparison.summary.unknown}`);
  console.log("");
  console.log("Extracted results:");

  for (const result of comparison.results) {
    const marker = result.status.toUpperCase().padEnd(7, " ");
    console.log(`  ${marker} ${result.testName}: ${result.value} | ideal ${result.ideal || "n/a"} | line ${result.lineNumber}`);
  }

  if (comparison.prescriptions.length) {
    console.log("");
    console.log("Suggested prescriptions:");
    for (const prescription of comparison.prescriptions) {
      console.log(`  - ${prescription.nome}`);
    }
  }

  if (report.expectedComparison) {
    console.log("");
    console.log("Expected-values comparison:");
    console.log(`  Expected: ${report.expectedComparison.summary.expectedCount}`);
    console.log(`  Matched: ${report.expectedComparison.summary.matched}`);
    console.log(`  Missing: ${report.expectedComparison.summary.missing}`);
    console.log(`  Mismatched: ${report.expectedComparison.summary.mismatched}`);
    console.log(`  Accuracy: ${(report.expectedComparison.summary.accuracy * 100).toFixed(1)}%`);
  }
}

const args = process.argv.slice(2);
const pdfPath = args.find((arg) => !arg.startsWith("--"));
const asJson = args.includes("--json");
const launchDirectory = process.env.INIT_CWD || process.cwd();
const expectedIndex = args.indexOf("--expected");
const expectedPath = expectedIndex >= 0 ? args[expectedIndex + 1] : "";

if (!pdfPath) {
  printUsage();
  process.exit(1);
}

try {
  const expectedValues = expectedPath
    ? JSON.parse(await readFile(path.resolve(launchDirectory, expectedPath), "utf8"))
    : null;
  const report = await testPdfAnalysis(path.resolve(launchDirectory, pdfPath), { expectedValues });
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printSummary(report);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
