-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'MARKET_ALERT';

-- DropIndex
DROP INDEX "Alert_enabled_assetId_idx";

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "evaluationReason" VARCHAR(80),
ADD COLUMN     "interval" VARCHAR(4) NOT NULL DEFAULT '15m',
ADD COLUMN     "lastObservationAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastValue" DECIMAL(24,10),
ADD COLUMN     "matched" BOOLEAN;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "triggerId" UUID;

-- CreateTable
CREATE TABLE "AlertObservation" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(80) NOT NULL,
    "interval" VARCHAR(4) NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastPublishedAt" TIMESTAMPTZ(3),
    "failureCode" VARCHAR(80),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertTrigger" (
    "id" UUID NOT NULL,
    "alertId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "observationAt" TIMESTAMPTZ(3) NOT NULL,
    "triggeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" VARCHAR(80) NOT NULL,
    "condition" "AlertCondition" NOT NULL,
    "threshold" DECIMAL(24,10) NOT NULL,
    "value" DECIMAL(24,10) NOT NULL,
    "interval" VARCHAR(4) NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "providerSymbol" VARCHAR(80) NOT NULL,
    "priceKind" VARCHAR(20) NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "lastPublishedAt" TIMESTAMPTZ(3),
    "failureCode" VARCHAR(80),
    "deliveryStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "deliveredAt" TIMESTAMPTZ(3),

    CONSTRAINT "AlertTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertObservation_completedAt_lastPublishedAt_createdAt_idx" ON "AlertObservation"("completedAt", "lastPublishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AlertTrigger_userId_triggeredAt_idx" ON "AlertTrigger"("userId", "triggeredAt");

-- CreateIndex
CREATE INDEX "AlertTrigger_deliveryStatus_lastPublishedAt_triggeredAt_idx" ON "AlertTrigger"("deliveryStatus", "lastPublishedAt", "triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertTrigger_alertId_observationAt_key" ON "AlertTrigger"("alertId", "observationAt");

-- CreateIndex
CREATE INDEX "Alert_enabled_assetId_interval_idx" ON "Alert"("enabled", "assetId", "interval");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_triggerId_key" ON "Notification"("triggerId");

-- AddForeignKey
ALTER TABLE "AlertTrigger" ADD CONSTRAINT "AlertTrigger_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
