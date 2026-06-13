CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "cpf" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Ativo',
    "prescription" TEXT NOT NULL DEFAULT '',
    "doctorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Consultation" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Patient_name_idx" ON "Patient"("name");
CREATE INDEX "Patient_status_idx" ON "Patient"("status");
CREATE INDEX "Patient_doctorId_idx" ON "Patient"("doctorId");
CREATE INDEX "Consultation_patientId_idx" ON "Consultation"("patientId");
CREATE INDEX "Consultation_createdAt_idx" ON "Consultation"("createdAt");

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
