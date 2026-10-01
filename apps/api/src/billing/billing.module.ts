import { Global, Module } from "@nestjs/common";
import { AdminPaymentsController, BillingController, StripeWebhookController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { EntitlementsService } from "./entitlements.service";
import { StripeSubscriptionService } from "./stripe-subscription.service";
import { StripeTestService } from "./stripe-test.service";
@Global()
@Module({
  controllers: [BillingController, AdminPaymentsController, StripeWebhookController],
  providers: [BillingService, EntitlementsService, StripeTestService, StripeSubscriptionService],
  exports: [EntitlementsService],
})
export class BillingModule {}
