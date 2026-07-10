CREATE TABLE "PlanTemplate" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "frequency" TEXT NOT NULL,
  "sessions" INTEGER NOT NULL DEFAULT 4,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanTemplateItem" (
  "id" SERIAL NOT NULL,
  "templateId" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanTemplate_name_idx" ON "PlanTemplate"("name");
CREATE INDEX "PlanTemplateItem_templateId_idx" ON "PlanTemplateItem"("templateId");

ALTER TABLE "PlanTemplateItem"
  ADD CONSTRAINT "PlanTemplateItem_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "PlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
