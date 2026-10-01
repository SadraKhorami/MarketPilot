-- Global expiry cleanup cannot use indexes whose leading column is owner/status.
-- Additive only: no data reset or backfill. Plan index creation during a maintenance window on large tables.
CREATE INDEX "BotLinkToken_expiresAt_idx" ON "BotLinkToken"("expiresAt");
CREATE INDEX "BotCommand_expiresAt_idx" ON "BotCommand"("expiresAt");
