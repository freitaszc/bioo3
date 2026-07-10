CREATE TABLE "Supplier" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "contact" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "clinicId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockLot" (
  "id" SERIAL NOT NULL,
  "productId" INTEGER NOT NULL,
  "clinicId" INTEGER NOT NULL,
  "supplierId" INTEGER,
  "batchNumber" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
  "id" SERIAL NOT NULL,
  "productId" INTEGER NOT NULL,
  "clinicId" INTEGER NOT NULL,
  "lotId" INTEGER,
  "userId" INTEGER,
  "patientId" INTEGER,
  "patientPlanId" INTEGER,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_clinicId_name_key" ON "Supplier"("clinicId", "name");
CREATE INDEX "Supplier_clinicId_idx" ON "Supplier"("clinicId");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");
CREATE UNIQUE INDEX "StockLot_productId_batchNumber_key" ON "StockLot"("productId", "batchNumber");
CREATE INDEX "StockLot_clinicId_idx" ON "StockLot"("clinicId");
CREATE INDEX "StockLot_productId_idx" ON "StockLot"("productId");
CREATE INDEX "StockLot_supplierId_idx" ON "StockLot"("supplierId");
CREATE INDEX "StockLot_expiresAt_idx" ON "StockLot"("expiresAt");
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");
CREATE INDEX "StockMovement_clinicId_idx" ON "StockMovement"("clinicId");
CREATE INDEX "StockMovement_lotId_idx" ON "StockMovement"("lotId");
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");
CREATE INDEX "StockMovement_patientId_idx" ON "StockMovement"("patientId");
CREATE INDEX "StockMovement_patientPlanId_idx" ON "StockMovement"("patientPlanId");
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_patientPlanId_fkey" FOREIGN KEY ("patientPlanId") REFERENCES "PatientPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
