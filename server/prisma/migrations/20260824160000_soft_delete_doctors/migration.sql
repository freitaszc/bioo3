ALTER TABLE "Doctor" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Doctor_deletedAt_idx" ON "Doctor"("deletedAt");
