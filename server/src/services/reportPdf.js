import PDFDocument from "pdfkit";

const statusLabels = { LOW: "Abaixo", NORMAL: "Normal", HIGH: "Acima", MISSING: "Não encontrado" };

function safeFilePart(value) {
  return String(value || "paciente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "paciente";
}

export function reportFileName(patientName) {
  return `Relatorio-BioO3-${safeFilePart(patientName)}.pdf`;
}

export function generateAnalysisReport(analysis) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: reportFileName(analysis.patientName) } });
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fillColor("#075985").fontSize(22).text("BioO3");
    doc.fillColor("#647888").fontSize(10).text("Relatório de diagnóstico e prescrição");
    doc.moveDown().strokeColor("#bae6fd").moveTo(48, doc.y).lineTo(547, doc.y).stroke().moveDown();

    doc.fillColor("#075985").fontSize(15).text("Informações do paciente");
    doc.fillColor("#122533").fontSize(11);
    doc.text(`Paciente: ${analysis.patientName || "Não informado"}`);
    doc.text(`Idade: ${analysis.patientAge || "Não informada"}`);
    doc.text(`Sexo: ${analysis.patientGender || "Não informado"}`);
    doc.text(`CPF: ${analysis.patientCpf || "Não informado"}`);
    doc.text(`Clínica: ${analysis.batch?.clinic?.name || "Não informada"}`);

    doc.moveDown().fillColor("#075985").fontSize(15).text("Resultados analisados");
    doc.moveDown(0.4);
    for (const result of analysis.results || []) {
      doc.fillColor("#122533").fontSize(11).text(result.testName, { continued: true, width: 180 });
      doc.text(`  ${result.value ?? "—"} ${result.unit || ""}  ·  ${statusLabels[result.status] || result.status}  ·  Ideal: ${result.ideal}`);
    }

    doc.moveDown().fillColor("#075985").fontSize(15).text("Prescrição");
    doc.moveDown(0.4).fillColor("#122533").fontSize(11)
      .text(analysis.prescriptionText || "Nenhuma prescrição gerada.");

    const doctor = analysis.batch?.doctor;
    doc.moveDown(3).fillColor("#122533").fontSize(11).text(doctor?.name || "Prescritor não informado", { align: "center" });
    doc.fillColor("#647888").fontSize(10)
      .text([doctor?.councilType, doctor?.councilNumber].filter(Boolean).join(" ") || "Conselho não informado", { align: "center" });

    doc.end();
  });
}
