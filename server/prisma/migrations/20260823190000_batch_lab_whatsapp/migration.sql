ALTER TABLE "Clinic" ADD COLUMN "whatsappPhone" TEXT NOT NULL DEFAULT '';

CREATE TABLE "AnalysisBatch" (
  "id" TEXT NOT NULL,
  "clinicId" INTEGER NOT NULL,
  "doctorId" INTEGER NOT NULL,
  "createdById" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT NOT NULL DEFAULT '',
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalysisBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisSourceFile" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "pageCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "purgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalysisSourceFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabAnalysis" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceFileId" TEXT NOT NULL,
  "patientId" INTEGER,
  "pageStart" INTEGER NOT NULL,
  "pageEnd" INTEGER NOT NULL,
  "patientName" TEXT NOT NULL DEFAULT '',
  "patientAge" INTEGER NOT NULL DEFAULT 0,
  "patientCpf" TEXT NOT NULL DEFAULT '',
  "patientGender" TEXT NOT NULL DEFAULT '',
  "matchingStatus" TEXT NOT NULL DEFAULT 'NEW',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "diagnosisText" TEXT NOT NULL DEFAULT '',
  "prescriptionText" TEXT NOT NULL DEFAULT '',
  "hasAlteration" BOOLEAN NOT NULL DEFAULT false,
  "error" TEXT NOT NULL DEFAULT '',
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabResult" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "testName" TEXT NOT NULL,
  "value" DOUBLE PRECISION,
  "rawValue" TEXT NOT NULL DEFAULT '',
  "unit" TEXT NOT NULL DEFAULT '',
  "ideal" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'MISSING',
  "edited" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisDocument" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'REPORT',
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "purgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalysisDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppConnection" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "businessAccountId" TEXT NOT NULL DEFAULT '',
  "phoneNumberId" TEXT NOT NULL DEFAULT '',
  "displayPhone" TEXT NOT NULL DEFAULT '',
  "encryptedAccessToken" TEXT NOT NULL DEFAULT '',
  "connectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppDelivery" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "recipientPhone" TEXT NOT NULL,
  "templateName" TEXT NOT NULL,
  "metaMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT NOT NULL DEFAULT '',
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalysisSourceFile_storageKey_key" ON "AnalysisSourceFile"("storageKey");
CREATE UNIQUE INDEX "LabResult_analysisId_testName_key" ON "LabResult"("analysisId", "testName");
CREATE UNIQUE INDEX "AnalysisDocument_storageKey_key" ON "AnalysisDocument"("storageKey");
CREATE UNIQUE INDEX "AnalysisDocument_analysisId_kind_key" ON "AnalysisDocument"("analysisId", "kind");
CREATE UNIQUE INDEX "WhatsAppDelivery_analysisId_key" ON "WhatsAppDelivery"("analysisId");
CREATE UNIQUE INDEX "WhatsAppDelivery_metaMessageId_key" ON "WhatsAppDelivery"("metaMessageId");

CREATE INDEX "AnalysisBatch_clinicId_idx" ON "AnalysisBatch"("clinicId");
CREATE INDEX "AnalysisBatch_doctorId_idx" ON "AnalysisBatch"("doctorId");
CREATE INDEX "AnalysisBatch_status_idx" ON "AnalysisBatch"("status");
CREATE INDEX "AnalysisBatch_createdAt_idx" ON "AnalysisBatch"("createdAt");
CREATE INDEX "AnalysisSourceFile_batchId_idx" ON "AnalysisSourceFile"("batchId");
CREATE INDEX "AnalysisSourceFile_expiresAt_idx" ON "AnalysisSourceFile"("expiresAt");
CREATE INDEX "LabAnalysis_batchId_idx" ON "LabAnalysis"("batchId");
CREATE INDEX "LabAnalysis_sourceFileId_idx" ON "LabAnalysis"("sourceFileId");
CREATE INDEX "LabAnalysis_patientId_idx" ON "LabAnalysis"("patientId");
CREATE INDEX "LabAnalysis_status_idx" ON "LabAnalysis"("status");
CREATE INDEX "LabResult_testName_idx" ON "LabResult"("testName");
CREATE INDEX "LabResult_status_idx" ON "LabResult"("status");
CREATE INDEX "AnalysisDocument_expiresAt_idx" ON "AnalysisDocument"("expiresAt");
CREATE INDEX "WhatsAppDelivery_status_idx" ON "WhatsAppDelivery"("status");
CREATE INDEX "WhatsAppDelivery_createdAt_idx" ON "WhatsAppDelivery"("createdAt");

ALTER TABLE "AnalysisBatch" ADD CONSTRAINT "AnalysisBatch_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalysisBatch" ADD CONSTRAINT "AnalysisBatch_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalysisBatch" ADD CONSTRAINT "AnalysisBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalysisSourceFile" ADD CONSTRAINT "AnalysisSourceFile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AnalysisBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabAnalysis" ADD CONSTRAINT "LabAnalysis_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AnalysisBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabAnalysis" ADD CONSTRAINT "LabAnalysis_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "AnalysisSourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabAnalysis" ADD CONSTRAINT "LabAnalysis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "LabAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisDocument" ADD CONSTRAINT "AnalysisDocument_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "LabAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDelivery" ADD CONSTRAINT "WhatsAppDelivery_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "LabAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
