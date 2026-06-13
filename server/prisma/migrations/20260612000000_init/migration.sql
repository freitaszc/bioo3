CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "secondName" TEXT NOT NULL DEFAULT '',
    "birthdate" TIMESTAMP(3),
    "email" TEXT,
    "profileImagePath" TEXT NOT NULL DEFAULT '/assets/user-icon.png',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'pdf',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "AnalysisEvent_createdAt_idx" ON "AnalysisEvent"("createdAt");
CREATE INDEX "AnalysisEvent_userId_idx" ON "AnalysisEvent"("userId");

ALTER TABLE "AnalysisEvent"
ADD CONSTRAINT "AnalysisEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

