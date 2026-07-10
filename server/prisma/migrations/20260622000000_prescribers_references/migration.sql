ALTER TABLE "Doctor" ADD COLUMN "councilType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Doctor" ADD COLUMN "councilNumber" TEXT NOT NULL DEFAULT '';

CREATE TABLE "ReferenceOverride" (
  "id" SERIAL NOT NULL,
  "clinicId" INTEGER NOT NULL,
  "testName" TEXT NOT NULL,
  "ideal" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferenceOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferenceOverride_clinicId_testName_key" ON "ReferenceOverride"("clinicId", "testName");
CREATE INDEX "ReferenceOverride_clinicId_idx" ON "ReferenceOverride"("clinicId");
ALTER TABLE "ReferenceOverride" ADD CONSTRAINT "ReferenceOverride_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
