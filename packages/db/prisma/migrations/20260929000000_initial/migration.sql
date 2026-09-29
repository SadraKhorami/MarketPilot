-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AlertCondition" AS ENUM ('PRICE_ABOVE', 'PRICE_BELOW', 'PERCENT_CHANGE_ABOVE', 'PERCENT_CHANGE_BELOW', 'RSI_ABOVE', 'RSI_BELOW');

-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('WEB', 'TELEGRAM', 'DISCORD');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" "RoleName" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" UUID NOT NULL,
    "watchlistId" UUID NOT NULL,
    "assetId" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "assetId" VARCHAR(80) NOT NULL,
    "condition" "AlertCondition" NOT NULL,
    "threshold" DECIMAL(24,10) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastEvaluatedAt" TIMESTAMPTZ(3),
    "lastTriggeredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationChannel" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "externalAccountId" VARCHAR(200),
    "displayName" VARCHAR(120),
    "verifiedAt" TIMESTAMPTZ(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "prefix" VARCHAR(24) NOT NULL,
    "secretHash" CHAR(64) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "apiKeyId" UUID,
    "requestId" VARCHAR(80) NOT NULL,
    "route" VARCHAR(160) NOT NULL,
    "method" VARCHAR(12) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "requestId" VARCHAR(80),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "UserRole_roleId_userId_idx" ON "UserRole"("roleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Watchlist_userId_updatedAt_idx" ON "Watchlist"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_name_key" ON "Watchlist"("userId", "name");

-- CreateIndex
CREATE INDEX "WatchlistItem_watchlistId_position_idx" ON "WatchlistItem"("watchlistId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_assetId_key" ON "WatchlistItem"("watchlistId", "assetId");

-- CreateIndex
CREATE INDEX "Alert_userId_enabled_createdAt_idx" ON "Alert"("userId", "enabled", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_enabled_assetId_idx" ON "Alert"("enabled", "assetId");

-- CreateIndex
CREATE INDEX "NotificationChannel_userId_active_idx" ON "NotificationChannel"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationChannel_provider_externalAccountId_key" ON "NotificationChannel"("provider", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationChannel_userId_provider_key" ON "NotificationChannel"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_userId_revokedAt_createdAt_idx" ON "ApiKey"("userId", "revokedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_userId_occurredAt_idx" ON "ApiUsage"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "ApiUsage_apiKeyId_occurredAt_idx" ON "ApiUsage"("apiKeyId", "occurredAt");

-- CreateIndex
CREATE INDEX "ApiUsage_requestId_idx" ON "ApiUsage"("requestId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_occurredAt_idx" ON "ActivityLog"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityLog_eventType_occurredAt_idx" ON "ActivityLog"("eventType", "occurredAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationChannel" ADD CONSTRAINT "NotificationChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
