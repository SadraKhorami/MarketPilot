-- CreateTable
CREATE TABLE "BotLinkToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "candidateId" VARCHAR(200),
    "candidateName" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalDelivery" (
    "id" UUID NOT NULL,
    "triggerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "destination" VARCHAR(200) NOT NULL,
    "linkedAt" TIMESTAMPTZ(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "adminRetries" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendingAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "receiptId" VARCHAR(200),
    "failureCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExternalDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotCommand" (
    "id" UUID NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "eventId" VARCHAR(80) NOT NULL,
    "payload" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "replyIndex" INTEGER NOT NULL DEFAULT 0,
    "replyAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureCode" VARCHAR(80),
    "requestId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "sendingAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotRuntime" (
    "provider" "ChannelProvider" NOT NULL,
    "inboundAt" TIMESTAMPTZ(3),
    "checkedAt" TIMESTAMPTZ(3),
    "successfulAt" TIMESTAMPTZ(3),
    "failureCode" VARCHAR(80),

    CONSTRAINT "BotRuntime_pkey" PRIMARY KEY ("provider")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotLinkToken_tokenHash_key" ON "BotLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "BotLinkToken_userId_provider_expiresAt_idx" ON "BotLinkToken"("userId", "provider", "expiresAt");

-- CreateIndex
CREATE INDEX "ExternalDelivery_status_nextAttemptAt_idx" ON "ExternalDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ExternalDelivery_userId_provider_createdAt_idx" ON "ExternalDelivery"("userId", "provider", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalDelivery_triggerId_channelId_destination_key" ON "ExternalDelivery"("triggerId", "channelId", "destination");

-- CreateIndex
CREATE INDEX "BotCommand_status_expiresAt_idx" ON "BotCommand"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BotCommand_provider_eventId_key" ON "BotCommand"("provider", "eventId");

-- AddForeignKey
ALTER TABLE "BotLinkToken" ADD CONSTRAINT "BotLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDelivery" ADD CONSTRAINT "ExternalDelivery_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "AlertTrigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDelivery" ADD CONSTRAINT "ExternalDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDelivery" ADD CONSTRAINT "ExternalDelivery_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "NotificationChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
