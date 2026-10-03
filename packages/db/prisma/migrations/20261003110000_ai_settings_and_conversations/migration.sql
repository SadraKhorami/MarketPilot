ALTER TABLE "AiRun" ADD COLUMN "billingSource" VARCHAR(12) NOT NULL DEFAULT 'platform', ADD COLUMN "archivedAt" TIMESTAMPTZ(3), ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
CREATE TABLE "AiSettings" (
 "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "language" VARCHAR(8) NOT NULL DEFAULT 'auto', "memory" VARCHAR(1200) NOT NULL DEFAULT '',
 "source" VARCHAR(12) NOT NULL DEFAULT 'platform', "encryptedKey" TEXT, "keyLast4" VARCHAR(4),
 "modelId" VARCHAR(200), "requestBudget" DOUBLE PRECISION NOT NULL DEFAULT 1, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "AiModel" (
 "id" VARCHAR(200) PRIMARY KEY, "name" VARCHAR(300) NOT NULL, "contextLength" INTEGER NOT NULL,
 "supportedParameters" TEXT[] NOT NULL, "promptPrice" DOUBLE PRECISION NOT NULL, "completionPrice" DOUBLE PRECISION NOT NULL,
 "requestPrice" DOUBLE PRECISION NOT NULL, "compatible" BOOLEAN NOT NULL, "active" BOOLEAN NOT NULL DEFAULT TRUE, "syncedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "AiModel_active_compatible_name_idx" ON "AiModel"("active", "compatible", "name");
