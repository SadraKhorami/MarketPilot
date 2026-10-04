ALTER TABLE "TradePreferences" ADD COLUMN "entryPolicy" JSONB;
-- Existing preference intervals, JSON plans, entry triggers and executions remain unchanged.
-- Missing conditionalEntry means legacy semantics; new rules are never backfilled without evidence.
