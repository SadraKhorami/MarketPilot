import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type Stripe from "stripe";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser, Public, Roles } from "../common/auth";
import { PageQueryDto } from "../common/request-query.dto";
import { CancellationDto, CheckoutDto, PaymentsQueryDto } from "./billing.dto";
import { BillingService } from "./billing.service";
import { StripeTestService } from "./stripe-test.service";

@ApiTags("Test billing")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("billing")
export class BillingController {
  constructor(private readonly service: BillingService) {}
  @Get()
  @ApiOperation({ summary: "Own test subscription, plans and enforced resource limits" })
  async overview(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.overview(user.id) };
  }
  @Get("payments")
  @ApiOperation({ summary: "Own paginated test payment history" })
  async payments(@CurrentUser() user: AuthenticatedUser, @Query() query: PageQueryDto) {
    return { data: await this.service.payments(user.id, query) };
  }
  @Post("checkout")
  @ApiOperation({ summary: "Start Pro test checkout; never charges live money" })
  async checkout(@CurrentUser() user: AuthenticatedUser, @Body() body: CheckoutDto) {
    return { data: await this.service.checkout(user.id, body.requestId) };
  }
  @Post("refresh")
  @HttpCode(200)
  async refresh(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.reconcile(user.id) };
  }
  @Post("reconcile/:sessionId")
  @HttpCode(200)
  async reconcile(@CurrentUser() user: AuthenticatedUser, @Param("sessionId") sessionId: string) {
    if (!/^cs_test_[a-zA-Z0-9]{1,110}$/.test(sessionId)) throw new BadRequestException("Invalid test checkout ID.");
    return { data: await this.service.reconcile(user.id, sessionId) };
  }
  @Post("cancellation")
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthenticatedUser, @Body() body: CancellationDto) {
    return { data: await this.service.cancellation(user.id, body.cancelAtPeriodEnd) };
  }
}

@ApiTags("Administration")
@ApiSessionAuth()
@Roles("ADMIN")
@Controller("admin/payments")
export class AdminPaymentsController {
  constructor(private readonly service: BillingService) {}
  @Get() async list(@Query() query: PaymentsQueryDto) {
    return { data: await this.service.adminPayments(query) };
  }
  @Get("subscriptions") async subscriptions(@Query() query: PageQueryDto) {
    return { data: await this.service.adminSubscriptions(query) };
  }
  @Get("summary") async summary() {
    return { data: await this.service.adminSummary() };
  }
}

@Controller("billing/webhook")
export class StripeWebhookController {
  constructor(
    private readonly service: BillingService,
    private readonly provider: StripeTestService,
  ) {}
  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Req() request: Request & { rawBody?: Buffer }, @Headers("stripe-signature") signature?: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret?.startsWith("whsec_")) throw new ServiceUnavailableException("Stripe test webhook is not configured.");
    if (!request.rawBody || !signature) throw new BadRequestException("Invalid webhook signature.");
    let event: Stripe.Event;
    try {
      event = this.provider.stripe.webhooks.constructEvent(request.rawBody, signature, secret);
    } catch {
      throw new BadRequestException("Invalid webhook signature.");
    }
    await this.service.webhook(event);
    return { received: true };
  }
}
