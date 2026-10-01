-- CreateEnum
CREATE TYPE "PlanName" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('DEMO', 'STRIPE_TEST');

-- CreateTable
CREATE TABLE "Subscription" (
    "userId" UUID NOT NULL,
    "plan" "PlanName" NOT NULL DEFAULT 'FREE',
    "provider" "BillingProvider" NOT NULL DEFAULT 'DEMO',
    "status" VARCHAR(32) NOT NULL DEFAULT 'free',
    "stripeCustomerId" VARCHAR(120),
    "stripeSubscriptionId" VARCHAR(120),
    "currentPeriodEnd" TIMESTAMPTZ(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "stripeSessionId" VARCHAR(120),
    "stripeInvoiceId" VARCHAR(120),
    "checkoutUrl" TEXT,
    "hostedInvoiceUrl" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaUsage" (
    "userId" UUID NOT NULL,
    "day" CHAR(10) NOT NULL,
    "resource" VARCHAR(24) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuotaUsage_pkey" PRIMARY KEY ("userId","day","resource")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_stripeSessionId_key" ON "BillingPayment"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_stripeInvoiceId_key" ON "BillingPayment"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "BillingPayment_userId_createdAt_idx" ON "BillingPayment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingPayment_provider_status_createdAt_idx" ON "BillingPayment"("provider", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_userId_requestId_key" ON "BillingPayment"("userId", "requestId");

-- CreateIndex
CREATE INDEX "QuotaUsage_day_idx" ON "QuotaUsage"("day");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaUsage" ADD CONSTRAINT "QuotaUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

