CREATE TABLE "Receipt" (
  "id" SERIAL NOT NULL,
  "saleId" INTEGER NOT NULL,
  "clinicId" INTEGER NOT NULL,
  "patientId" INTEGER,
  "number" TEXT NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "discountAmount" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "bioo3Share" DECIMAL(10,2) NOT NULL,
  "clinicShare" DECIMAL(10,2) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalDocument" (
  "id" SERIAL NOT NULL,
  "saleId" INTEGER NOT NULL,
  "clinicId" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "documentNumber" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PROVIDER',
  "error" TEXT NOT NULL DEFAULT '',
  "documentUrl" TEXT,
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receipt_saleId_key" ON "Receipt"("saleId");
CREATE UNIQUE INDEX "Receipt_number_key" ON "Receipt"("number");
CREATE INDEX "Receipt_clinicId_idx" ON "Receipt"("clinicId");
CREATE INDEX "Receipt_patientId_idx" ON "Receipt"("patientId");
CREATE INDEX "Receipt_issuedAt_idx" ON "Receipt"("issuedAt");
CREATE UNIQUE INDEX "FiscalDocument_saleId_key" ON "FiscalDocument"("saleId");
CREATE INDEX "FiscalDocument_clinicId_idx" ON "FiscalDocument"("clinicId");
CREATE INDEX "FiscalDocument_status_idx" ON "FiscalDocument"("status");
CREATE INDEX "FiscalDocument_createdAt_idx" ON "FiscalDocument"("createdAt");

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
