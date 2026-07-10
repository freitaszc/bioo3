CREATE TABLE "Sale" (
  "id" SERIAL NOT NULL,
  "clinicId" INTEGER NOT NULL,
  "patientId" INTEGER,
  "patientPlanId" INTEGER,
  "createdById" INTEGER,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "subtotal" DECIMAL(10,2) NOT NULL,
  "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(10,2) NOT NULL,
  "installments" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleItem" (
  "id" SERIAL NOT NULL,
  "saleId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Installment" (
  "id" SERIAL NOT NULL,
  "saleId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" SERIAL NOT NULL,
  "saleId" INTEGER NOT NULL,
  "installmentId" INTEGER,
  "clinicId" INTEGER NOT NULL,
  "userId" INTEGER,
  "amount" DECIMAL(10,2) NOT NULL,
  "method" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockMovement" ADD COLUMN "saleId" INTEGER;

CREATE INDEX "Sale_clinicId_idx" ON "Sale"("clinicId");
CREATE INDEX "Sale_patientId_idx" ON "Sale"("patientId");
CREATE INDEX "Sale_patientPlanId_idx" ON "Sale"("patientPlanId");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
CREATE UNIQUE INDEX "Installment_saleId_number_key" ON "Installment"("saleId", "number");
CREATE INDEX "Installment_saleId_idx" ON "Installment"("saleId");
CREATE INDEX "Installment_status_idx" ON "Installment"("status");
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");
CREATE INDEX "Payment_installmentId_idx" ON "Payment"("installmentId");
CREATE INDEX "Payment_clinicId_idx" ON "Payment"("clinicId");
CREATE INDEX "Payment_receivedAt_idx" ON "Payment"("receivedAt");
CREATE INDEX "StockMovement_saleId_idx" ON "StockMovement"("saleId");

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_patientPlanId_fkey" FOREIGN KEY ("patientPlanId") REFERENCES "PatientPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
