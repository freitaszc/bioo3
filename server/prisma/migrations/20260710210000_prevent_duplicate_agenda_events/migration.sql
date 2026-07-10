ALTER TABLE "AgendaEvent"
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "AgendaEvent_dedupeKey_key" ON "AgendaEvent"("dedupeKey");
