CREATE TABLE "AgendaEvent" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgendaEvent_startsAt_idx" ON "AgendaEvent"("startsAt");
