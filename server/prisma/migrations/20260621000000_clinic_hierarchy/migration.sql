CREATE TABLE "Clinic" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Clinic" ("name", "status", "updatedAt") VALUES ('BioO3', 'ACTIVE', CURRENT_TIMESTAMP);

ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'CLINIC';
ALTER TABLE "User" ADD COLUMN "clinicId" INTEGER;
ALTER TABLE "AnalysisEvent" ADD COLUMN "clinicId" INTEGER;
ALTER TABLE "Doctor" ADD COLUMN "clinicId" INTEGER;
ALTER TABLE "Patient" ADD COLUMN "clinicId" INTEGER;
ALTER TABLE "Product" ADD COLUMN "clinicId" INTEGER;
ALTER TABLE "AgendaEvent" ADD COLUMN "clinicId" INTEGER;
ALTER TABLE "Consultation" ADD COLUMN "clinicId" INTEGER;

UPDATE "User" SET "role" = 'ADMIN';
UPDATE "User" SET "clinicId" = (SELECT "id" FROM "Clinic" WHERE "name" = 'BioO3' LIMIT 1)
WHERE "id" = (SELECT MIN("id") FROM "User");
UPDATE "AnalysisEvent" SET "clinicId" = (SELECT "id" FROM "Clinic" WHERE "name" = 'BioO3' LIMIT 1);
UPDATE "Doctor" SET "clinicId" = (SELECT "id" FROM "Clinic" WHERE "name" = 'BioO3' LIMIT 1);
UPDATE "Patient" SET "clinicId" = (SELECT "id" FROM "Clinic" WHERE "name" = 'BioO3' LIMIT 1);
UPDATE "Product" SET "clinicId" = (SELECT "id" FROM "Clinic" WHERE "name" = 'BioO3' LIMIT 1);
UPDATE "AgendaEvent" SET "clinicId" = (SELECT "id" FROM "Clinic" WHERE "name" = 'BioO3' LIMIT 1);
UPDATE "Consultation" c SET "clinicId" = p."clinicId" FROM "Patient" p WHERE c."patientId" = p."id";

ALTER TABLE "AnalysisEvent" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "Doctor" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "Patient" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "AgendaEvent" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "Consultation" ALTER COLUMN "clinicId" SET NOT NULL;

DROP INDEX IF EXISTS "Doctor_name_key";
CREATE UNIQUE INDEX "User_clinicId_key" ON "User"("clinicId");
CREATE INDEX "Clinic_name_idx" ON "Clinic"("name");
CREATE INDEX "Clinic_status_idx" ON "Clinic"("status");
CREATE INDEX "AnalysisEvent_clinicId_idx" ON "AnalysisEvent"("clinicId");
CREATE UNIQUE INDEX "Doctor_clinicId_name_key" ON "Doctor"("clinicId", "name");
CREATE INDEX "Doctor_clinicId_idx" ON "Doctor"("clinicId");
CREATE INDEX "Patient_clinicId_idx" ON "Patient"("clinicId");
CREATE INDEX "Product_clinicId_idx" ON "Product"("clinicId");
CREATE INDEX "AgendaEvent_clinicId_idx" ON "AgendaEvent"("clinicId");
CREATE INDEX "Consultation_clinicId_idx" ON "Consultation"("clinicId");

ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalysisEvent" ADD CONSTRAINT "AnalysisEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgendaEvent" ADD CONSTRAINT "AgendaEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
