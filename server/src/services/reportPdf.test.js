import assert from "node:assert/strict";
import test from "node:test";
import { generateAnalysisReport, reportFileName } from "./reportPdf.js";

test("generates the batch prescription with a prescription filename", async () => {
  const analysis = {
    patientName: "Paciente Exemplo",
    patientAge: 42,
    patientCpf: "",
    patientGender: "Feminino",
    prescriptionText: "- ADEK\nAplicação conforme orientação.",
    results: [
      { testName: "Vitamina B12", value: 250, unit: "pg/mL", status: "LOW", ideal: "500-700" },
      { testName: "25-hidroxi D3", value: 75, unit: "ng/mL", status: "NORMAL", ideal: "60-100" }
    ],
    batch: {
      clinic: { name: "Clínica Exemplo" },
      doctor: { name: "Prescritor Exemplo", councilType: "CRM", councilNumber: "12345" }
    }
  };

  assert.equal(reportFileName(analysis.patientName), "Prescricao-BioO3-Paciente-Exemplo.pdf");
  const buffer = await generateAnalysisReport(analysis);
  assert.ok(buffer.length > 500);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});
