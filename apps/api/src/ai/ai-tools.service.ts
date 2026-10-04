import {
  AIError,
  automaticEntryIntervals,
  resolveEntryPolicy,
  type TradeContext,
  type ConditionalEntry,
  AlertInputSchema,
  type Source,
  SourceSchema,
  type ToolName,
  type ToolResult,
  ToolResultSchema,
  toolSchemas,
} from "@marketpilot/ai";
import {
  calculateStructuralLevels,
  calculateTechnicalIndicators,
  calculateTrend,
  type MarketCandle,
  type MarketDataInterval,
  MarketObservationSchema,
  normalizeInstrumentSymbol,
  referenceMarkets,
} from "@marketpilot/market-data";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { MarketDataService, type MarketSnapshot } from "../market-data/market-data.service";
import { NewsService } from "../news/news.service";
import { WatchlistsService } from "../watchlists/watchlists.service";
import { completedSnapshotCandles } from "./market-evidence";
import { calculateTradeSetup } from "./trade-setup";

export interface ResearchContext {
  userId: string;
  runId: string;
  signal: AbortSignal;
  watchlistId?: string;
  tradeSymbol?: string;
  tradeInterval?: MarketDataInterval;
  tradeContext?: TradeContext;
  newsResult?: ToolResult;
  readOpenRisk?: (quote: string) => Promise<NonNullable<ConditionalEntry["openRisk"]>>;
  snapshots: Map<string, Promise<MarketSnapshot>>;
  propose: (input: {
    symbol: string;
    condition: "PRICE_ABOVE" | "PRICE_BELOW" | "RSI_ABOVE" | "RSI_BELOW";
    threshold: number;
  }) => Promise<ToolResult["proposal"]>;
}
export function resolveResearchSymbol(input: string) {
  return normalizeInstrumentSymbol(input);
}
function baseSource(kind: Source["kind"], title: string, source: string): Source {
  return {
    id: randomUUID(),
    kind,
    title,
    source,
    symbol: null,
    status: "ok",
    freshness: "not_applicable",
    observedAt: null,
    fetchedAt: new Date().toISOString(),
    url: null,
    facts: [],
    history: [],
    interval: null,
    windowStart: null,
    windowEnd: null,
    excerpt: null,
    error: null,
  };
}
@Injectable()
export class AiToolsService {
  constructor(
    private readonly market: MarketDataService,
    private readonly news: NewsService,
    private readonly watchlists: WatchlistsService,
  ) {}
  async execute(tool: ToolName, input: unknown, context: ResearchContext): Promise<ToolResult> {
    try {
      return await this.executeValidated(tool, input, context);
    } catch (error) {
      if (context.signal.aborted || error instanceof AIError || (error instanceof Error && error.name === "ZodError"))
        throw error;
      const unavailable = ToolResultSchema.parse({
        tool,
        status: "unavailable",
        sources: [
          {
            ...baseSource(tool === "getMarketNews" ? "news" : "market", "Research source unavailable", "MarketPilot"),
            status: "unavailable",
            error: "The requested source is temporarily unavailable.",
          },
        ],
        proposal: null,
        error: "The requested source is temporarily unavailable.",
      });
      if (tool === "getMarketNews") context.newsResult = unavailable;
      return unavailable;
    }
  }
  private async executeValidated(tool: ToolName, input: unknown, context: ResearchContext): Promise<ToolResult> {
    context.signal.throwIfAborted();
    const result: ToolResult = { tool, status: "ok", sources: [], proposal: null, error: null };
    if (tool === "getMarketNews") {
      const args = toolSchemas.getMarketNews.parse(input);
      const symbol = resolveResearchSymbol(context.tradeSymbol ?? args.symbol);
      const response = await this.news.list({ asset: symbol.split("-")[0], pageSize: args.limit });
      result.sources = response.data.articles.map((article) =>
        SourceSchema.parse({
          ...baseSource("news", article.title, article.source),
          id: `news:${article.id}`,
          symbol,
          freshness:
            article.publishedAt &&
            Date.now() >= article.publishedAt.getTime() &&
            Date.now() - article.publishedAt.getTime() <= 24 * 3_600_000
              ? "stored"
              : "stale",
          observedAt: article.publishedAt?.toISOString() ?? null,
          fetchedAt: article.fetchedAt.toISOString(),
          url: article.originalUrl,
          excerpt: article.description?.slice(0, 600) ?? null,
        }),
      );
      if (!result.sources.length) {
        result.status = "unavailable";
        result.error = "No relevant stored news is available. Sentiment scoring is unavailable.";
        result.sources = [
          {
            ...baseSource("news", `News for ${symbol}`, "MarketPilot RSS storage"),
            symbol,
            status: "unavailable",
            error: result.error,
          },
        ];
      }
      const older = result.sources.filter((source) => source.freshness === "stale").length;
      if (older)
        result.error = `${result.sources.length - older} recent news item(s); ${older} older or undated. News coverage is not an economic calendar.`;
      context.newsResult = result;
    } else if (tool === "getWatchlist") {
      const args = toolSchemas.getWatchlist.parse(input);
      if (context.watchlistId && args.watchlistId && args.watchlistId !== context.watchlistId)
        throw new AIError("AI_WATCHLIST_MISMATCH", "Use the selected watchlist.");
      const lists = await this.watchlists.list(context.userId);
      const id = context.watchlistId ?? args.watchlistId;
      const list = id ? lists.find((l) => l.id === id) : lists[0];
      if (!list) throw new AIError("AI_WATCHLIST_NOT_FOUND", "The selected watchlist is unavailable.");
      result.sources.push({
        ...baseSource("watchlist", list.name, "Your MarketPilot watchlist"),
        facts: [
          { label: "Assets", value: list.items.length, unit: "assets" },
          { label: "Omitted from this bounded summary", value: Math.max(0, list.items.length - 4), unit: "assets" },
        ],
      });
      if (!list.items.length) result.error = "This watchlist has no assets.";
      result.sources.push(
        ...(await this.multiple(
          list.items.slice(0, 4).map((i) => i.assetId),
          args.interval,
          args.window,
          context,
        )),
      );
      if (list.items.length > 4) result.status = "partial";
    } else if (tool === "compareAssets") {
      const args = toolSchemas.compareAssets.parse(input);
      result.sources = await this.multiple(
        [...new Set(args.symbols.map(resolveResearchSymbol))],
        args.interval,
        args.window,
        context,
      );
    } else if (tool === "getTradeSetup") {
      const args = toolSchemas.getTradeSetup.parse(input);
      if (context.tradeSymbol) args.symbol = context.tradeSymbol;
      const preferences = context.tradeContext;
      if (!preferences || !context.newsResult)
        throw new AIError(
          "AI_NO_EVIDENCE",
          "Confirm trading preferences and retrieve relevant news before proposing an entry.",
        );
      const policy = resolveEntryPolicy(preferences);
      if (policy.timeframeMode === "manual") args.interval = preferences.interval;
      else if (!automaticEntryIntervals(preferences.holding).some((interval) => interval === args.interval)) {
        result.status = "unavailable";
        result.error = "The proposed entry timeframe is outside the confirmed holding-style bounds.";
        return ToolResultSchema.parse(result);
      }
      if (
        (policy.scenario === "auto" && !args.scenario) ||
        (policy.condition === "auto" && !args.condition) ||
        (policy.timeframeMode === "auto" && !args.trendInterval) ||
        (policy.validityMode === "auto" && (args.validityCandles === undefined || !args.validityReason)) ||
        !args.rationale
      ) {
        result.status = "unavailable";
        result.error =
          "The AI proposal omitted an Auto selection. Request a complete scenario, condition, trend timeframe and bounded validity.";
        return ToolResultSchema.parse(result);
      }
      const symbol = resolveResearchSymbol(args.symbol);
      const snapshot = await this.snapshot(symbol, args.interval, context);

      const higher = { "1m": "15m", "5m": "1h", "15m": "1h", "1h": "6h", "6h": "1d", "1d": "1d" } as const;
      const trendInterval =
        policy.timeframeMode === "manual" ? policy.trendInterval : (args.trendInterval ?? higher[args.interval]);
      const contextSnapshot = await this.snapshot(symbol, trendInterval, context);
      const evaluatedAt = Date.now();
      const source = this.marketSource(snapshot, 50, tool, undefined, evaluatedAt);
      const contextSource = this.marketSource(contextSnapshot, 50, "getTrendAnalysis", undefined, evaluatedAt);
      const newsSources = context.newsResult.sources.filter((source) => source.status !== "unavailable");
      const latestPublishedAt =
        newsSources
          .map((source) => source.observedAt)
          .filter((time): time is string => !!time)
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
      const scenario = calculateTradeSetup(snapshot, args.direction, source.id, evaluatedAt, contextSnapshot, {
        preferences,
        scenario: args.scenario,
        condition: args.condition,
        validityCandles: args.validityCandles,
        rationale: args.rationale,
        validityReason: args.validityReason,
        news: {
          status: !newsSources.length
            ? "unavailable"
            : latestPublishedAt &&
                Date.now() >= Date.parse(latestPublishedAt) &&
                Date.now() - Date.parse(latestPublishedAt) <= 24 * 3_600_000
              ? "available"
              : "stale",
          latestPublishedAt,
          checkedAt: new Date().toISOString(),
          sourceIds: newsSources.map((source) => source.id),
          calendar: "unavailable",
        },
      });
      if (scenario.plan?.conditionalEntry) {
        scenario.plan.conditionalEntry.openRisk = await context.readOpenRisk?.(scenario.plan.quote);
      }
      result.status = scenario.plan ? "ok" : "unavailable";
      result.tradeSetup = scenario.plan;
      result.error = scenario.reason;
      if (scenario.plan) {
        source.facts.push(
          {
            label: "Entry basis",
            value:
              scenario.plan.direction === "BUY"
                ? "Prior completed-candle range high"
                : "Prior completed-candle range low",
            unit: "method",
          },
          { label: "Stop basis", value: "Recent swing extreme plus a quarter ATR buffer", unit: "method" },
          { label: "Conditional entry", value: scenario.plan.entry, unit: scenario.plan.quote },
          { label: "Scenario stop loss", value: scenario.plan.stopLoss, unit: scenario.plan.quote },
          ...(scenario.plan.conditionalEntry?.economics
            ? [
                {
                  label: "Weighted net reward/risk after user-estimated costs",
                  value: scenario.plan.conditionalEntry.economics.netRewardRisk,
                  unit: "R",
                },
                {
                  label: "User-estimated combined round-trip costs",
                  value: scenario.plan.conditionalEntry.economics.roundTripCostPercent,
                  unit: "%",
                },
              ]
            : []),
          ...scenario.plan.targets.map((target, index) => ({
            label: `Target ${index + 1} (observed structural level)`,
            value: target,
            unit: scenario.plan!.quote,
          })),
        );
      }
      result.sources = [SourceSchema.parse(source), contextSource];
    } else if (tool === "createAlert") {
      const args = AlertInputSchema.parse(input);
      const symbol = resolveResearchSymbol(args.symbol);
      if (context.tradeSymbol && symbol !== context.tradeSymbol)
        throw new AIError("AI_UNGROUNDED_ANSWER", "The alert market does not match the confirmed trading context.");
      await this.snapshot(symbol, "1h", context);
      result.proposal = await context.propose({ ...args, symbol });
      result.sources = [
        {
          ...baseSource("proposal", "Alert awaiting your confirmation", "MarketPilot"),
          symbol,
          facts: [
            {
              label: args.condition,
              value: args.threshold,
              unit: args.condition.startsWith("RSI") ? "index" : symbol.split("-")[1],
            },
          ],
        },
      ];
    } else {
      const args =
        tool === "getMarketPrice"
          ? { ...toolSchemas.getMarketPrice.parse(input), interval: "1h" as const, window: 300 }
          : toolSchemas[tool].parse(input);
      const symbol = resolveResearchSymbol(context.tradeSymbol ?? args.symbol);
      try {
        result.sources = [this.marketSource(await this.snapshot(symbol, args.interval, context), args.window, tool)];
      } catch (error) {
        if (context.signal.aborted || (error instanceof Error && error.name === "ZodError") || error instanceof AIError)
          throw error;
        result.sources = [this.unavailable(symbol)];
      }
    }
    if (result.sources.some((s) => s.status !== "ok") || result.sources.some((s) => s.freshness === "stale")) {
      result.status = result.sources.every((s) => s.status === "unavailable") ? "unavailable" : "partial";
    }
    context.signal.throwIfAborted();
    return ToolResultSchema.parse(result);
  }
  private async snapshot(symbol: string, interval: MarketDataInterval, context: ResearchContext) {
    const key = `${symbol}:${interval}`;
    let promise = context.snapshots.get(key);
    if (!promise) {
      promise = this.market.getMarketData(symbol, interval);
      context.snapshots.set(key, promise);
    }
    const snapshot = await promise;
    const data = MarketObservationSchema.parse(snapshot.data);
    const instrument = referenceMarkets.find((market) => market.symbol === symbol);
    const expectedSource = instrument?.provider ?? "coinbase-exchange";
    const expectedProviderSymbol = instrument?.providerSymbol ?? symbol;
    if (
      snapshot.requestedSymbol !== symbol ||
      data.symbol !== symbol ||
      data.providerSymbol !== expectedProviderSymbol ||
      snapshot.source !== expectedSource ||
      (data.source !== undefined && data.source !== expectedSource) ||
      data.interval !== interval
    )
      throw new AIError("AI_INVALID_TOOL_RESULT", "The market observation did not match the request.");
    return { ...snapshot, data };
  }
  private unavailable(symbol: string): Source {
    return {
      ...baseSource("market", symbol, "MarketPilot market service"),
      symbol,
      status: "unavailable",
      error: "This exact product or its observations are unavailable. The quote asset has not been changed.",
    };
  }
  private async multiple(symbols: string[], interval: MarketDataInterval, window: number, context: ResearchContext) {
    const results = await Promise.allSettled(
      symbols.map((s) => this.snapshot(resolveResearchSymbol(s), interval, context)),
    );
    const good = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const start = good.length ? Math.max(...good.map((s) => Date.parse(s.data.candles.slice(-window)[0].time))) : 0;
    const end = good.length ? Math.min(...good.map((s) => Date.parse(s.data.candles.at(-1)?.time ?? ""))) : 0;
    return results.map((result, i) => {
      if (result.status === "rejected") return this.unavailable(resolveResearchSymbol(symbols[i]));
      const candles = result.value.data.candles.filter((c) => Date.parse(c.time) >= start && Date.parse(c.time) <= end);
      return this.marketSource(result.value, window, "compareAssets", candles);
    });
  }
  private marketSource(
    snapshot: MarketSnapshot,
    window: number,
    tool: ToolName,
    aligned?: MarketCandle[],
    evaluatedAt = Date.now(),
  ): Source {
    const data = snapshot.data;
    const completed = completedSnapshotCandles(snapshot, evaluatedAt);
    const candles = aligned
      ? aligned.filter((candle) => completed.some((item) => item.time === candle.time))
      : completed.slice(-window);
    const quote = data.symbol.split("-")[1];
    const end = candles.at(-1);
    if (!end) return this.unavailable(data.symbol);
    // Earlier candles initialize indicators; comparison calculations never include bars after the shared endpoint.
    const calculationCandles = completed.filter((candle) => Date.parse(candle.time) <= Date.parse(end.time));
    const indicators = calculateTechnicalIndicators(calculationCandles);
    const price = aligned ? end.close : data.price;
    const source: Source = {
      ...baseSource("market", data.symbol, snapshot.source),
      symbol: data.symbol,
      observedAt: aligned ? end.time : data.timestamp,
      fetchedAt: snapshot.fetchedAt,
      freshness: snapshot.freshness,
      interval: data.interval,
      windowStart: candles[0]?.time ?? null,
      windowEnd: end.time,
      calculationHistory:
        tool === "getMarketPrice"
          ? undefined
          : {
              windowStart: calculationCandles[0].time,
              windowEnd: end.time,
              candles: calculationCandles.length,
            },
      history: candles.map((c) => ({ time: c.time, price: c.close })),
      facts: [
        {
          label: data.priceKind === "candle_close" ? "Latest candle close" : "Observed trade price",
          value: price,
          unit: quote,
        },
        { label: "Chart candles", value: candles.length, unit: "candles" },
      ],
    };
    if (tool !== "getMarketPrice") {
      source.facts.push(
        { label: "Latest completed candle close", value: end.close, unit: quote },
        { label: "Indicator basis", value: "Completed candles only", unit: "method" },
        { label: "RSI", value: indicators.rsi, unit: "index" },
        { label: "SMA 50", value: indicators.sma50, unit: quote },
        { label: "SMA 200", value: indicators.sma200, unit: quote },
        { label: "MACD", value: indicators.macd?.value ?? null, unit: quote },
        { label: "MACD signal", value: indicators.macd?.signal ?? null, unit: quote },
        { label: "MACD histogram", value: indicators.macd?.histogram ?? null, unit: quote },
        { label: "Bollinger upper", value: indicators.bollingerBands?.upper ?? null, unit: quote },
        { label: "Bollinger middle", value: indicators.bollingerBands?.middle ?? null, unit: quote },
        { label: "Bollinger lower", value: indicators.bollingerBands?.lower ?? null, unit: quote },
        { label: "Stochastic K", value: indicators.stochastic?.k ?? null, unit: "index" },
        { label: "Stochastic D", value: indicators.stochastic?.d ?? null, unit: "index" },
        { label: "ATR", value: indicators.atr, unit: quote },
      );
    }
    if (tool === "getTrendAnalysis" || tool === "compareAssets" || tool === "getWatchlist") {
      const levels = calculateStructuralLevels(calculationCandles);
      source.facts.push(
        { label: "Deterministic trend", value: calculateTrend(end.close, indicators), unit: "classification" },
        ...levels.support
          .filter((value) => value < price)
          .slice(-3)
          .reverse()
          .map((value, i) => ({ label: `Confirmed swing support ${i + 1}`, value, unit: quote })),
        ...levels.resistance
          .filter((value) => value > price)
          .slice(0, 3)
          .map((value, i) => ({ label: `Confirmed swing resistance ${i + 1}`, value, unit: quote })),
      );
    }
    if (candles.length < window || source.facts.some((f) => f.value === null)) {
      source.status = "partial";
      const missing = source.facts.filter((fact) => fact.value === null).map((fact) => fact.label);
      const reasons = [];
      if (candles.length < window) reasons.push(`Chart: ${candles.length}/${window} candles`);
      if (missing.length)
        reasons.push(
          `${calculationCandles.length} calculation candles; missing ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " and others" : ""}`,
        );
      source.error = reasons.join(". ").slice(0, 160);
    }
    return SourceSchema.parse(source);
  }
}
