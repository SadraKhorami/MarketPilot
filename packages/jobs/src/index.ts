import { type MarketDataInterval, marketDataIntervals, referenceMarkets } from "@marketpilot/market-data";
import { type JobsOptions, Queue } from "bullmq";

export const queueNames = [
  "market-refresh",
  "alert-evaluation",
  "notifications",
  "external-notifications",
  "bot-commands",
] as const;
export type QueueName = (typeof queueNames)[number];
export const queuePrefix = "marketpilot-jobs";
export const botHeartbeatKey = "marketpilot:bots:workers:v1";
export const heartbeatKey = "marketpilot:alerts:workers:v1";
export const intervalSeconds: Record<MarketDataInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "6h": 21600,
  "1d": 86400,
};
export function positiveConfig(name: string, fallback: number, minimum = 1, maximum = 86400) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid configuration: ${name}`);
  return value;
}
export function jobConfig() {
  return {
    cadenceMs: positiveConfig("ALERT_REFRESH_SECONDS", 60, 30, 3600) * 1000,
    refreshConcurrency: positiveConfig("ALERT_REFRESH_CONCURRENCY", 2, 1, 3),
    evaluationConcurrency: positiveConfig("ALERT_EVALUATION_CONCURRENCY", 4, 1, 16),
    notificationConcurrency: positiveConfig("ALERT_NOTIFICATION_CONCURRENCY", 4, 1, 16),
    providerJobsPerMinute: positiveConfig("ALERT_PROVIDER_JOBS_PER_MINUTE", 20, 1, 60),
    quoteMaxAgeMs: positiveConfig("ALERT_QUOTE_MAX_AGE_SECONDS", 120, 30, 600) * 1000,
    snapshotMaxAgeMs: positiveConfig("ALERT_SNAPSHOT_MAX_AGE_SECONDS", 120, 30, 600) * 1000,
    attempts: positiveConfig("ALERT_JOB_ATTEMPTS", 5, 1, 10),
  };
}
export function connectionOptions() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  if (!["redis:", "rediss:"].includes(url.protocol)) throw new Error("Invalid REDIS_URL protocol");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
export function jobOptions(): JobsOptions {
  return {
    attempts: jobConfig().attempts,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 1000 },
  };
}
export function createQueue(name: QueueName) {
  return new Queue(name, {
    prefix: queuePrefix,
    connection: {
      ...connectionOptions(),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    },
    defaultJobOptions: jobOptions(),
  });
}
export const supportedConditions = [
  "PRICE_ABOVE",
  "PRICE_BELOW",
  "RSI_ABOVE",
  "RSI_BELOW",
  "PERCENT_CHANGE_ABOVE",
  "PERCENT_CHANGE_BELOW",
] as const;
export function validateRule(rule: {
  assetId: string;
  condition: string;
  threshold: number;
  interval: string;
  cooldownMinutes: number;
}) {
  if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(rule.assetId) || !marketDataIntervals.some((value) => value === rule.interval))
    return false;
  if (
    !supportedConditions.some((value) => value === rule.condition) ||
    !Number.isFinite(rule.threshold) ||
    Math.abs(rule.threshold) >= 1e14
  )
    return false;
  if (!Number.isInteger(rule.cooldownMinutes) || rule.cooldownMinutes < 0 || rule.cooldownMinutes > 10080) return false;
  if (rule.condition.startsWith("PRICE_") && rule.threshold <= 0) return false;
  if (rule.condition.startsWith("RSI_") && (rule.threshold < 0 || rule.threshold > 100)) return false;
  return true;
}
export function expectedInstrument(symbol: string) {
  const reference = referenceMarkets.find((item) => item.symbol === symbol);
  return {
    source: reference?.provider ?? "coinbase-exchange",
    providerSymbol: reference?.providerSymbol ?? symbol,
    quote: reference?.quoteAsset ?? symbol.split("-")[1],
  };
}
