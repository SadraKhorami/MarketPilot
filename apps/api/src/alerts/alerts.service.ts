import { Prisma } from "@marketpilot/db";
import { validateRule } from "@marketpilot/jobs";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { EntitlementsService } from "../billing/entitlements.service";
import { ActivityService } from "../common/activity.service";
import { PageQueryDto, pageResult } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { MarketCatalogService } from "../market-data/market-catalog.service";
import { CreateAlertDto, UpdateAlertDto } from "./alerts.dto";
import { AlertsQueryDto } from "./alerts-query.dto";

@Injectable()
export class AlertsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityService,
    private readonly entitlements: EntitlementsService,
    @Optional() private readonly catalog?: MarketCatalogService,
  ) {}

  async list(userId: string, query = new AlertsQueryDto()) {
    const where: Prisma.AlertWhereInput = {
      userId,
      ...(query.status === "all" ? {} : { enabled: query.status === "active" }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { assetId: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.alert.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.alert.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async summary(userId: string) {
    const [total, active] = await Promise.all([
      this.db.alert.count({ where: { userId } }),
      this.db.alert.count({ where: { userId, enabled: true } }),
    ]);
    return { total, active, paused: total - active };
  }
  async detail(userId: string, id: string) {
    const alert = await this.db.alert.findFirst({ where: { id, userId } });
    if (!alert) throw new NotFoundException("Alert not found.");
    return alert;
  }
  async history(userId: string, id: string, query: PageQueryDto) {
    await this.detail(userId, id);
    const where = { alertId: id, userId };
    const [items, total] = await Promise.all([
      this.db.alertTrigger.findMany({
        where,
        orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.alertTrigger.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  private async validate(
    input: { assetId: string; condition: string; threshold: number; interval: string; cooldownMinutes: number },
    checkMarket: boolean,
  ) {
    if (!validateRule(input) || new Prisma.Decimal(input.threshold).decimalPlaces() > 10)
      throw new BadRequestException("Use a supported canonical market, condition, timeframe and valid threshold.");
    if (checkMarket) {
      if (!this.catalog)
        throw new ServiceUnavailableException({
          error: { code: "MARKET_CATALOG_UNAVAILABLE", message: "Market validation is temporarily unavailable." },
        });
      const catalog = await this.catalog.list();
      const market = catalog.instruments.find((item) => item.symbol === input.assetId && item.available);
      if (!market && catalog.error)
        throw new ServiceUnavailableException({
          error: { code: "MARKET_CATALOG_UNAVAILABLE", message: "Market validation is temporarily unavailable." },
        });
      if (!market) throw new BadRequestException("Select an available market from the catalog.");
    }
  }

  async create(userId: string, input: CreateAlertDto, transaction?: Prisma.TransactionClient) {
    if (input.name !== undefined && !input.name.trim()) throw new BadRequestException("Enter an alert name.");
    await this.validate(
      {
        assetId: input.assetId.toUpperCase(),
        condition: input.condition,
        threshold: input.threshold,
        interval: input.interval ?? "15m",
        cooldownMinutes: input.cooldownMinutes ?? 60,
      },
      true,
    );
    const create = async (store: Prisma.TransactionClient) => {
      if (input.enabled !== false) await this.entitlements.capacity(store, userId, "activeAlerts");
      const alert = await store.alert.create({
        data: {
          userId,
          name: input.name.trim(),
          assetId: input.assetId.toUpperCase(),
          interval: input.interval ?? "15m",
          condition: input.condition,
          threshold: new Prisma.Decimal(input.threshold),
          enabled: input.enabled ?? true,
          cooldownMinutes: input.cooldownMinutes ?? 60,
        },
      });
      await store.activityLog.create({
        data: {
          userId,
          eventType: "ALERT_CREATED",
          description: `Created alert ${alert.name}`,
          metadata: { alertId: alert.id, assetId: alert.assetId },
        },
      });
      return alert;
    };
    return transaction ? create(transaction) : this.entitlements.locked(userId, create);
  }

  async update(userId: string, id: string, input: UpdateAlertDto) {
    const current = await this.detail(userId, id);
    if (input.name !== undefined && !input.name.trim()) throw new BadRequestException("Enter an alert name.");
    // Pausing a legacy/unsupported rule must always remain possible.
    const changesCondition =
      input.assetId !== undefined ||
      input.condition !== undefined ||
      input.threshold !== undefined ||
      input.interval !== undefined ||
      input.cooldownMinutes !== undefined;
    if (changesCondition || input.enabled === true) {
      await this.validate(
        {
          assetId: (input.assetId ?? current.assetId).toUpperCase(),
          condition: input.condition ?? current.condition,
          threshold: input.threshold ?? Number(current.threshold),
          interval: input.interval ?? current.interval,
          cooldownMinutes: input.cooldownMinutes ?? current.cooldownMinutes,
        },
        input.assetId !== undefined,
      );
    }
    const data: Prisma.AlertUpdateManyMutationInput = { ...input };
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.assetId !== undefined) data.assetId = input.assetId.toUpperCase();
    if (input.threshold !== undefined) data.threshold = new Prisma.Decimal(input.threshold);
    if (
      input.assetId !== undefined ||
      input.interval !== undefined ||
      input.condition !== undefined ||
      input.threshold !== undefined ||
      input.enabled === true
    ) {
      data.matched = null;
      data.lastObservationAt = null;
      data.lastValue = null;
      data.evaluationReason = "AWAITING_BASELINE";
    }
    const result = await this.entitlements.locked(userId, async (tx) => {
      if (input.enabled === true && !current.enabled) await this.entitlements.capacity(tx, userId, "activeAlerts");
      return tx.alert.updateMany({ where: { id, userId, updatedAt: current.updatedAt }, data });
    });
    if (!result.count) throw new BadRequestException("This alert changed. Reload it before editing.");
    await this.activity.record(userId, "ALERT_UPDATED", "Updated an alert", { alertId: id });
    return this.db.alert.findUniqueOrThrow({ where: { id } });
  }

  async remove(userId: string, id: string) {
    const result = await this.db.alert.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Alert not found." } });
    await this.activity.record(userId, "ALERT_DELETED", "Deleted an alert", { alertId: id });
    return { success: true };
  }
}
