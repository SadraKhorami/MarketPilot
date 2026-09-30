CREATE TYPE "RequestAuthType" AS ENUM ('SESSION', 'API_KEY');
ALTER TABLE "ApiUsage" ADD COLUMN "authType" "RequestAuthType" NOT NULL DEFAULT 'SESSION';
UPDATE "ApiUsage" SET "authType" = 'API_KEY' WHERE "apiKeyId" IS NOT NULL;
CREATE INDEX "ApiUsage_authType_occurredAt_idx" ON "ApiUsage"("authType", "occurredAt");
CREATE INDEX "ApiUsage_occurredAt_idx" ON "ApiUsage"("occurredAt");
