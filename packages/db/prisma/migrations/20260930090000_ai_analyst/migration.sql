CREATE TABLE "AiRun" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "requestId" UUID NOT NULL, "conversationId" UUID NOT NULL,
  "input" VARCHAR(2000) NOT NULL, "inputHash" CHAR(64) NOT NULL, "status" VARCHAR(20) NOT NULL, "result" JSONB, "errorCode" VARCHAR(80),
  "model" VARCHAR(160) NOT NULL, "inputTokens" INTEGER NOT NULL DEFAULT 0, "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DOUBLE PRECISION, "reservedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "toolCount" INTEGER NOT NULL DEFAULT 0, "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiRun_status_check" CHECK ("status" IN ('running','completed','failed','cancelled')),
  CONSTRAINT "AiRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiRun_userId_requestId_key" ON "AiRun"("userId", "requestId");
CREATE INDEX "AiRun_userId_conversationId_createdAt_idx" ON "AiRun"("userId", "conversationId", "createdAt");
CREATE INDEX "AiRun_createdAt_status_idx" ON "AiRun"("createdAt", "status");
CREATE INDEX "AiRun_expiresAt_idx" ON "AiRun"("expiresAt");
CREATE TABLE "AiAlertProposal" (
  "id" UUID NOT NULL, "runId" UUID NOT NULL, "symbol" VARCHAR(32) NOT NULL, "condition" "AlertCondition" NOT NULL,
  "threshold" DECIMAL(24,10) NOT NULL, "state" VARCHAR(20) NOT NULL DEFAULT 'pending', "alertId" UUID,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAlertProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiAlertProposal_state_check" CHECK ("state" IN ('pending','confirmed','cancelled')),
  CONSTRAINT "AiAlertProposal_threshold_check" CHECK ("threshold" > 0),
  CONSTRAINT "AiAlertProposal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiAlertProposal_runId_key" ON "AiAlertProposal"("runId");
CREATE INDEX "AiAlertProposal_expiresAt_idx" ON "AiAlertProposal"("expiresAt");
