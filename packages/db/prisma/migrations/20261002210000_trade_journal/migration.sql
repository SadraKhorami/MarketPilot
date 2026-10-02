-- AlterTable
ALTER TABLE "AiRun" ADD COLUMN     "tradeContext" JSONB;

-- CreateTable
CREATE TABLE "TradePreferences" (
    "userId" UUID NOT NULL,
    "capital" DOUBLE PRECISION,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "riskPercent" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "interval" VARCHAR(4) NOT NULL DEFAULT '15m',
    "holding" VARCHAR(12) NOT NULL DEFAULT 'day',
    "autoReview" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TradePreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'planned',
    "plan" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "analysis" JSONB NOT NULL,
    "notes" VARCHAR(4000) NOT NULL DEFAULT '',
    "entryPrice" DOUBLE PRECISION,
    "exitPrice" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "checkedAt" TIMESTAMPTZ(3),
    "monitoringStatus" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEvent" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "evidence" JSONB NOT NULL,
    "review" VARCHAR(2000),
    "reviewStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',

    CONSTRAINT "JournalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalEntry_userId_symbol_createdAt_idx" ON "JournalEntry"("userId", "symbol", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEntry_status_checkedAt_idx" ON "JournalEntry"("status", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_userId_runId_key" ON "JournalEntry"("userId", "runId");

-- CreateIndex
CREATE INDEX "JournalEvent_entryId_occurredAt_idx" ON "JournalEvent"("entryId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEvent_entryId_key_key" ON "JournalEvent"("entryId", "key");

-- AddForeignKey
ALTER TABLE "TradePreferences" ADD CONSTRAINT "TradePreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEvent" ADD CONSTRAINT "JournalEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

