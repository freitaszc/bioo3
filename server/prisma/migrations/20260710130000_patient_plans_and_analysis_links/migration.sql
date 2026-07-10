ALTER TABLE "AnalysisEvent" ADD COLUMN "patientId" INTEGER;

CREATE TABLE "PatientPlan" (
  "id" SERIAL NOT NULL,
  "patientId" INTEGER NOT NULL,
  "clinicId" INTEGER NOT NULL,
  "templateId" INTEGER,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "frequency" TEXT NOT NULL,
  "sessions" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUOTE',
  "items" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatientPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanSession" (
  "id" SERIAL NOT NULL,
  "patientPlanId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalysisEvent_patientId_idx" ON "AnalysisEvent"("patientId");
CREATE INDEX "PatientPlan_patientId_idx" ON "PatientPlan"("patientId");
CREATE INDEX "PatientPlan_clinicId_idx" ON "PatientPlan"("clinicId");
CREATE INDEX "PatientPlan_templateId_idx" ON "PatientPlan"("templateId");
CREATE INDEX "PatientPlan_status_idx" ON "PatientPlan"("status");
CREATE UNIQUE INDEX "PlanSession_patientPlanId_number_key" ON "PlanSession"("patientPlanId", "number");
CREATE INDEX "PlanSession_patientPlanId_idx" ON "PlanSession"("patientPlanId");
CREATE INDEX "PlanSession_status_idx" ON "PlanSession"("status");

ALTER TABLE "AnalysisEvent"
  ADD CONSTRAINT "AnalysisEvent_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientPlan"
  ADD CONSTRAINT "PatientPlan_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientPlan"
  ADD CONSTRAINT "PatientPlan_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientPlan"
  ADD CONSTRAINT "PatientPlan_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "PlanTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlanSession"
  ADD CONSTRAINT "PlanSession_patientPlanId_fkey"
  FOREIGN KEY ("patientPlanId") REFERENCES "PatientPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
