DELETE FROM "ReferenceOverride" current
USING "ReferenceOverride" newer
WHERE current."testName" = newer."testName"
  AND (current."updatedAt", current."id") < (newer."updatedAt", newer."id");

ALTER TABLE "ReferenceOverride" DROP CONSTRAINT "ReferenceOverride_clinicId_fkey";
DROP INDEX "ReferenceOverride_clinicId_testName_key";
DROP INDEX "ReferenceOverride_clinicId_idx";
ALTER TABLE "ReferenceOverride" DROP COLUMN "clinicId";
CREATE UNIQUE INDEX "ReferenceOverride_testName_key" ON "ReferenceOverride"("testName");
