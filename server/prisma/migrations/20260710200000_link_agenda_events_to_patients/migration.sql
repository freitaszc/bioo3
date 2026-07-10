ALTER TABLE "AgendaEvent"
  ADD COLUMN "patientId" INTEGER;

ALTER TABLE "AgendaEvent"
  ADD CONSTRAINT "AgendaEvent_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AgendaEvent_patientId_idx" ON "AgendaEvent"("patientId");
