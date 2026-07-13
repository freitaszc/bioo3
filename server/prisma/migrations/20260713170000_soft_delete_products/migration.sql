ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");
