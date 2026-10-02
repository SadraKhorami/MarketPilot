import { randomUUID } from "node:crypto";
import {
  AIError,
  AlertInputSchema,
  type Source,
  SourceSchema,
  type ToolName,
  type ToolResult,
  ToolResultSchema,
  toolSchemas,
} from "@marketpilot/ai";
import {
  normalizeInstrumentSymbol,
  referenceMarkets,
  calculateSupportResistance,
  calculateTechnicalIndicators,
  calculateTrend,
  type MarketCandle,
  type MarketDataInterval,
  MarketObservationSchema,
} from "@marketpilot/market-data";
import { Injectable } from "@nestjs/common";
import { MarketDataService, type MarketSnapshot } from "../market-data/market-data.service";
import { NewsService } from "../news/news.service";
import { WatchlistsService } from "../watchlists/watchlists.service";
import { calculateTradeSetup } from "./trade-setup";

export interface ResearchContext {
  userId: string;
  runId: string;
  signal: AbortSignal;
  watchlistId?: string;
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
      return ToolResultSchema.parse({
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
    }
  }
  private async executeValidated(tool: ToolName, input: unknown, context: ResearchContext): Promise<ToolResult> {
    context.signal.throwIfAborted();
    const result: ToolResult = { tool, status: "ok", sources: [], proposal: null, error: null };
    if (tool === "getMarketNews") {
      const args = toolSchemas.getMarketNews.parse(input);
      const symbol = resolveResearchSymbol(args.symbol);
      const response = await this.news.list({ asset: symbol.split("-")[0], pageSize: args.limit });
      result.sources = response.data.articles.map((article) =>
        SourceSchema.parse({
          ...baseSource("news", article.title, article.source),
          id: `news:${article.id}`,
          symbol,
          freshness: "stored",
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
      const symbol = resolveResearchSymbol(args.symbol);
      const snapshot = await this.snapshot(symbol, args.interval, context);
      const source = this.marketSource(snapshot, 50, tool);
      const scenario = calculateTradeSetup(snapshot, args.direction, source.id);
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
          { label: "TP 1 (one risk unit)", value: scenario.plan.targets[0], unit: scenario.plan.quote },
          { label: "TP 2 (two risk units)", value: scenario.plan.targets[1], unit: scenario.plan.quote },
        );
      } else {
        source.status = "partial";
        source.error = scenario.reason;
      }
      result.sources = [SourceSchema.parse(source)];
    } else if (tool === "createAlert") {
      const args = AlertInputSchema.parse(input);
      const symbol = resolveResearchSymbol(args.symbol);
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
      const symbol = resolveResearchSymbol(args.symbol);
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
  private marketSource(snapshot: MarketSnapshot, window: number, tool: ToolName, aligned?: MarketCandle[]): Source {
    const data = snapshot.data;
    const candles = aligned ?? data.candles.slice(-window);
    const quote = data.symbol.split("-")[1];
    const end = candles.at(-1);
    if (!end) return this.unavailable(data.symbol);
    // Earlier candles initialize indicators; comparison calculations never include bars after the shared endpoint.
    const calculationCandles = data.candles.filter((candle) => Date.parse(candle.time) <= Date.parse(end.time));
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
      const levels = calculateSupportResistance(candles);
      source.facts.push(
        { label: "Deterministic trend", value: calculateTrend(price, indicators), unit: "classification" },
        ...levels.support.slice(0, 3).map((value, i) => ({ label: `Support ${i + 1}`, value, unit: quote })),
        ...levels.resistance.slice(0, 3).map((value, i) => ({ label: `Resistance ${i + 1}`, value, unit: quote })),
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
