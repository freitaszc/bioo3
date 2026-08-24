import { prisma } from "../prisma.js";
import { generateReportForAnalysis, processBatch } from "./batchAnalysis.js";
import { markDeliveryFailed, sendQueuedDelivery } from "./whatsapp.js";
import { deleteObject } from "./objectStorage.js";

let timer = null;
let running = false;
let lastPurgeAt = 0;

async function recoverInterruptedJobs() {
  const stale = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.analysisBatch.updateMany({ where: { status: "PROCESSING", updatedAt: { lt: stale } }, data: { status: "QUEUED" } });
  await prisma.labAnalysis.updateMany({ where: { status: "REPORTING", updatedAt: { lt: stale } }, data: { status: "CONFIRMED" } });
  await prisma.whatsAppDelivery.updateMany({ where: { status: "SENDING", updatedAt: { lt: stale } }, data: { status: "FAILED", lastError: "Envio interrompido; tente novamente." } });
}

async function purgeExpiredDocuments() {
  const now = new Date();
  const sourceFiles = await prisma.analysisSourceFile.findMany({ where: { expiresAt: { lte: now }, purgedAt: null }, take: 20 });
  const reports = await prisma.analysisDocument.findMany({ where: { expiresAt: { lte: now }, purgedAt: null }, take: 20 });
  for (const file of sourceFiles) {
    try { await deleteObject(file.storageKey); } catch { /* retry on the next cycle */ continue; }
    await prisma.analysisSourceFile.update({ where: { id: file.id }, data: { purgedAt: now } });
  }
  for (const file of reports) {
    try { await deleteObject(file.storageKey); } catch { /* retry on the next cycle */ continue; }
    await prisma.analysisDocument.update({ where: { id: file.id }, data: { purgedAt: now } });
  }
}

export async function runBackgroundCycle() {
  if (running) return;
  running = true;
  try {
    const batch = await prisma.analysisBatch.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
    if (batch) await processBatch(batch.id);

    const report = await prisma.labAnalysis.findFirst({ where: { status: "CONFIRMED" }, orderBy: { confirmedAt: "asc" } });
    if (report) await generateReportForAnalysis(report.id);

    const delivery = await prisma.whatsAppDelivery.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
    if (delivery) {
      try { await sendQueuedDelivery(delivery.id); }
      catch (error) { await markDeliveryFailed(delivery.id, error); }
    }
    if (Date.now() - lastPurgeAt > 60 * 60 * 1000) {
      await purgeExpiredDocuments();
      lastPurgeAt = Date.now();
    }
  } finally {
    running = false;
  }
}

export async function startBackgroundWorker() {
  await recoverInterruptedJobs();
  await runBackgroundCycle();
  timer = setInterval(() => runBackgroundCycle().catch(console.error), 3000);
  timer.unref?.();
}

export function stopBackgroundWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
