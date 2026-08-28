import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import PDFDocument from "pdfkit";

const statusLabels = { LOW: "Abaixo", NORMAL: "Normal", HIGH: "Acima", MISSING: "Não encontrado" };
const colors = {
  text: "#122533",
  muted: "#647888",
  accent: "#075985",
  border: "#d8edf7",
  header: "#e0f2fe",
  panel: "#f0f9ff"
};
const logoPath = fileURLToPath(new URL("../../../client/public/assets/logo.svg", import.meta.url));
let logoBufferPromise;

function loadLogoBuffer() {
  if (!logoBufferPromise) {
    logoBufferPromise = readFile(logoPath, "utf8").then(async (source) => {
      const fills = {};
      for (const match of source.matchAll(/\.(cls-\d+)\s*\{\s*fill:\s*([^;]+);?\s*\}/g)) {
        fills[match[1]] = match[2].trim();
      }
      const svg = source
        .replace(/<style>[\s\S]*?<\/style>/, "")
        .replace(/class="(cls-\d+)"/g, (_match, name) => `fill="${fills[name] || "#000"}"`);
      const image = await loadImage(Buffer.from(svg));
      const canvas = createCanvas(240, 240);
      canvas.getContext("2d").drawImage(image, 0, 0, 240, 240);
      return canvas.toBuffer("image/png");
    });
  }
  return logoBufferPromise;
}

function safeFilePart(value) {
  return String(value || "paciente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "paciente";
}

export function reportFileName(patientName) {
  return `Prescricao-BioO3-${safeFilePart(patientName)}.pdf`;
}

function ensureSpace(doc, height) {
  const bottom = doc.page.height - doc.page.margins.bottom - 24;
  if (doc.y + height <= bottom) return;
  doc.addPage();
  doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();
  doc.y = doc.page.margins.top;
}

function drawSectionTitle(doc, title) {
  ensureSpace(doc, 34);
  doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(15)
    .text(title, doc.page.margins.left, doc.y);
  doc.moveDown(0.55);
}

function drawPatientGrid(doc, analysis) {
  const items = [
    ["Paciente", analysis.patientName || "Não informado"],
    ["Idade", analysis.patientAge || "Não informada"],
    ["Sexo", analysis.patientGender || "Não informado"],
    ["CPF", analysis.patientCpf || "Não informado"]
  ];
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const gap = 8;
  const width = (doc.page.width - doc.page.margins.left - doc.page.margins.right - gap * 3) / 4;
  const height = 64;

  items.forEach(([label, value], index) => {
    const x = startX + index * (width + gap);
    doc.roundedRect(x, startY, width, height, 7).fillAndStroke(colors.panel, colors.border);
    doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(7.5)
      .text(label.toUpperCase(), x + 8, startY + 9, { width: width - 16 });
    doc.fillColor(colors.text).font("Helvetica-Bold").fontSize(8.5)
      .text(String(value), x + 8, startY + 25, { width: width - 16, height: 34 });
  });
  doc.y = startY + height + 20;
}

function drawResultsTable(doc, results) {
  const startX = doc.page.margins.left;
  const widths = [155, 96, 78, 170];
  const headers = ["Exame", "Valor", "Status", "Referência"];
  const headerHeight = 27;
  const rowHeight = 36;
  const rows = results.length
    ? results.map((result) => [
      result.testName,
      `${result.value ?? "—"} ${result.unit || ""}`.trim(),
      statusLabels[result.status] || result.status,
      result.ideal || ""
    ])
    : [["Nenhum valor alterado encontrado.", "", "", ""]];

  ensureSpace(doc, headerHeight + rowHeight * rows.length + 12);
  let y = doc.y;
  let x = startX;
  headers.forEach((header, index) => {
    doc.rect(x, y, widths[index], headerHeight).fillAndStroke(colors.header, colors.border);
    doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(8)
      .text(header.toUpperCase(), x + 7, y + 9, { width: widths[index] - 14, align: index === 0 ? "left" : "center" });
    x += widths[index];
  });

  y += headerHeight;
  rows.forEach((row) => {
    x = startX;
    row.forEach((value, index) => {
      doc.rect(x, y, widths[index], rowHeight).fillAndStroke("#ffffff", colors.border);
      doc.fillColor(colors.text).font("Helvetica").fontSize(9)
        .text(String(value), x + 7, y + 10, { width: widths[index] - 14, height: 20, ellipsis: true, align: index === 0 ? "left" : "center" });
      x += widths[index];
    });
    y += rowHeight;
  });
  doc.y = y + 20;
}

function drawPrescription(doc, prescriptionText, reservedHeight = 0) {
  const text = prescriptionText || "Nenhuma prescrição gerada.";
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentWidth = width - 24;
  // heightOfString uses the document's current font. The section title leaves
  // a 15pt bold font active, which greatly overestimates this block unless the
  // prescription style is selected before measuring it.
  const bottom = doc.page.height - doc.page.margins.bottom - 24;
  const availableHeight = bottom - doc.y - reservedHeight - 12;
  let fontSize = 11;
  let lineGap = 2;
  doc.font("Helvetica").fontSize(fontSize);
  let textHeight = doc.heightOfString(text, { width: contentWidth, lineGap });

  // The standard B12 + D prescription is verbose. Compact it only as much as
  // needed to preserve the complete text and its signature on page one.
  while (Math.max(52, textHeight + 24) > availableHeight && fontSize > 8) {
    fontSize -= 0.5;
    lineGap = fontSize <= 9 ? 1 : 2;
    doc.fontSize(fontSize);
    textHeight = doc.heightOfString(text, { width: contentWidth, lineGap });
  }

  const height = Math.max(52, textHeight + 24);
  // Keep the prescription and signature together. For the B12/D report this
  // reserves the signature area while deciding whether the content fits.
  ensureSpace(doc, height + 12 + reservedHeight);
  const y = doc.y;
  doc.roundedRect(doc.page.margins.left, y, width, height, 7).fillAndStroke("#ffffff", colors.border);
  doc.fillColor(colors.text)
    .text(text, doc.page.margins.left + 12, y + 12, { width: contentWidth, lineGap });
  doc.y = y + height;
}

export async function generateAnalysisReport(analysis) {
  const logo = await loadLogoBuffer();
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: reportFileName(analysis.patientName) } });
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();

    const date = new Intl.DateTimeFormat("pt-BR").format(analysis.confirmedAt || new Date());
    doc.image(logo, 48, 45, { width: 58, height: 58 });
    doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(22).text("BioO3", 118, 56);
    doc.fillColor(colors.muted).font("Helvetica").fontSize(10)
      .text("Relatório de diagnóstico e prescrição", 118, 82);
    doc.text(`Data: ${date}`, 400, 55, { width: 147, align: "right" });
    doc.strokeColor("#bae6fd").lineWidth(2).moveTo(48, 113).lineTo(547, 113).stroke();
    doc.y = 132;

    drawSectionTitle(doc, "Informações do paciente");
    drawPatientGrid(doc, analysis);

    drawSectionTitle(doc, "Diagnóstico - valores alterados");
    const abnormalResults = (analysis.results || []).filter((result) => ["LOW", "HIGH"].includes(result.status));
    drawResultsTable(doc, abnormalResults);

    drawSectionTitle(doc, "Prescrição");
    const signatureBlockHeight = 110;
    drawPrescription(doc, analysis.prescriptionText, signatureBlockHeight);

    const doctor = analysis.batch?.doctor;
    ensureSpace(doc, signatureBlockHeight);
    const signatureY = doc.y + 54;
    doc.strokeColor(colors.text).lineWidth(1).moveTo(148, signatureY).lineTo(448, signatureY).stroke();
    doc.fillColor(colors.text).font("Helvetica-Bold").fontSize(11)
      .text(doctor?.name || "Prescritor não informado", 148, signatureY + 8, { width: 300, align: "center" });
    doc.fillColor(colors.muted).font("Helvetica").fontSize(10)
      .text([doctor?.councilType, doctor?.councilNumber].filter(Boolean).join(" ") || "Conselho não informado", 148, signatureY + 24, { width: 300, align: "center" });

    doc.fillColor(colors.muted).font("Helvetica").fontSize(9)
      .text("BioO3", 48, doc.page.height - doc.page.margins.bottom - 12, { width: 499, align: "center" });

    doc.end();
  });
}
