import assert from "node:assert/strict";
import test from "node:test";
import { PDFParse } from "pdf-parse";
import { generateAnalysisReport, reportFileName } from "./reportPdf.js";

test("keeps the signature on the first page of the B12 and D prescription", async () => {
  const analysis = {
    patientName: "Paciente Exemplo",
    patientAge: 42,
    patientCpf: "",
    patientGender: "Feminino",
    prescriptionText: [
      "- B12 2.500mg",
      "Preparo: Diluir conforme orientação do fabricante.",
      "Aplicação: Aplicar dose única (IM).",
      "",
      "- ADEK2 600.000 UI",
      "Preparo: Aplicar intramuscular lento e profundo, usar agulha 0,7x30mm, observando que essa aplicação deve ser realizada no quadrante superior externo do glúteo (não administrar no deltoide). Observação: Não deixar o óleo retornar, risco de agressão cutânea gerando vermelhidão local.",
      "Aplicação: Aplicar dose única (IM)."
    ].join("\n"),
    results: [
      { testName: "Vitamina B12", value: 250, unit: "pg/mL", status: "LOW", ideal: "500-700" },
      { testName: "25-hidroxi D3", value: 25, unit: "ng/mL", status: "LOW", ideal: "60-100" }
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

  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    assert.equal(parsed.pages.length, 1);
    assert.match(parsed.pages[0].text, /Prescritor Exemplo/);
    assert.match(parsed.pages[0].text, /CRM 12345/);
  } finally {
    await parser.destroy();
  }
});
