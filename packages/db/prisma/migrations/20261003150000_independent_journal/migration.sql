ALTER TABLE "JournalEntry" ALTER COLUMN "runId" DROP NOT NULL;
ALTER TABLE "JournalEntry"
  ADD COLUMN "source" VARCHAR(12) NOT NULL DEFAULT 'ai',
  ADD COLUMN "trackingMode" VARCHAR(12) NOT NULL DEFAULT 'observed',
  ADD COLUMN "entryTrigger" VARCHAR(16) NOT NULL DEFAULT 'touch',
  ADD COLUMN "resultBasis" VARCHAR(12) NOT NULL DEFAULT 'recorded',
  ADD COLUMN "targetAllocations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "importKey" VARCHAR(64),
  ADD COLUMN "archivedAt" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "JournalEntry_userId_importKey_key" ON "JournalEntry"("userId", "importKey");
CREATE TABLE "JournalExit" (
  "id" UUID NOT NULL, "entryId" UUID NOT NULL, "key" VARCHAR(80) NOT NULL,
  "price" DOUBLE PRECISION NOT NULL, "quantity" DOUBLE PRECISION NOT NULL,
  "fees" DOUBLE PRECISION NOT NULL DEFAULT 0, "reason" VARCHAR(16) NOT NULL,
  "basis" VARCHAR(12) NOT NULL, "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "JournalExit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalExit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "JournalExit_entryId_key_key" ON "JournalExit"("entryId", "key");
CREATE INDEX "JournalExit_entryId_occurredAt_idx" ON "JournalExit"("entryId", "occurredAt");
