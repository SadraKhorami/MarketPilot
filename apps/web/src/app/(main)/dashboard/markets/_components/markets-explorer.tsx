"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import { marketSourceLabel, type MarketObservation } from "@marketpilot/market-data";
import { ArrowUpRight, CandlestickChart, CircleAlert } from "lucide-react";

import {
  AssetMark,
  MarketSymbolField,
  marketName,
  normalizeMarketSymbol,
  suggestedMarketSymbols,
} from "@/app/(main)/dashboard/_components/market-symbol-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { useMarketCatalog } from "../../_components/market-catalog-provider";
import { MarketSparkline } from "../../_components/market-sparkline";

type Snapshot = { source: string; freshness: "fresh" | "stale"; fetchedAt: string; data: MarketObservation };
type LookupState =
  | { status: "loading"; snapshot?: Snapshot }
  | { status: "ready"; snapshot: Snapshot; warning?: string }
  | { status: "error"; message: string };

export function MarketsExplorer() {
  const catalog = useMarketCatalog();
  const [query, setQuery] = useState("");
  const [symbols, setSymbols] = useState(suggestedMarketSymbols);
  const [lookups, setLookups] = useState<Record<string, LookupState>>({});
  const lookupRef = useRef<(symbol: string) => Promise<void>>(() => Promise.resolve());
  const symbolsRef = useRef(symbols);

  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  const lookup = useCallback(async (symbol: string) => {
    const normalized = normalizeMarketSymbol(symbol);
    if (!normalized) return;
    setSymbols((current) => (current.includes(normalized) ? current : [normalized, ...current].slice(0, 12)));
    setLookups((current) => {
      const existing = current[normalized];
      const oldSnapshot = existing && existing.status !== "error" ? existing.snapshot : undefined;
      return { ...current, [normalized]: { status: "loading", snapshot: oldSnapshot } };
    });
    try {
      const { data } = await apiRequest<ApiEnvelope<Snapshot>>(
        `/market-data/${encodeURIComponent(normalized)}?interval=15m`,
      );
      setLookups((current) => ({ ...current, [normalized]: { status: "ready", snapshot: data } }));
    } catch (reason) {
      setLookups((current) => {
        const previous = current[normalized];
        const message = reason instanceof Error ? reason.message : "Market data unavailable.";
        return {
          ...current,
          [normalized]:
            previous?.status === "loading" && previous.snapshot
              ? { status: "ready", snapshot: { ...previous.snapshot, freshness: "stale" }, warning: message }
              : { status: "error", message },
        };
      });
    }
  }, []);

  useEffect(() => {
    lookupRef.current = lookup;
  }, [lookup]);

  useEffect(() => {
    for (const symbol of suggestedMarketSymbols) void lookup(symbol);
    let lastAutoRefresh = Date.now();
    const refresh = () => {
      if (document.visibilityState === "visible" && Date.now() - lastAutoRefresh >= 65_000) {
        lastAutoRefresh = Date.now();
        for (const symbol of symbolsRef.current.slice(0, 8)) void lookupRef.current(symbol);
      }
    };
    const timer = window.setInterval(refresh, 65_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [lookup]);

  const visibleSymbols = useMemo(
    () =>
      symbols.filter((symbol) =>
        `${symbol} ${symbol.split("-")[0]}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, symbols],
  );

  const quoteCount = visibleSymbols.filter((symbol) => lookups[symbol]?.status === "ready").length;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <FieldGroup className="max-w-sm">
            <Field>
              <FieldLabel htmlFor="market-product-search">Explore markets</FieldLabel>
              <MarketSymbolField
                id="market-product-search"
                value={query}
                allowAll
                onChange={(value) => {
                  setQuery(value);
                  if (value) void lookup(value);
                }}
              />
            </Field>
          </FieldGroup>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="font-medium">Crypto · Forex · Metals · Stocks</span>
              <span className="text-muted-foreground text-xs">Automatic updates · 15m candles</span>
            </div>
            <Badge variant="secondary">{quoteCount} observations</Badge>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="markets-list-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="markets-list-title" className="font-semibold text-lg tracking-tight">
              {query
                ? `${catalog.data?.instruments.find((item) => item.symbol === query)?.name ?? marketName(query)} market`
                : "Market explorer"}
            </h2>
            <p className="text-muted-foreground text-sm">Price, momentum and recent candle history at a glance.</p>
          </div>
          <span className="text-muted-foreground text-xs">Updates about once a minute</span>
        </div>

        {visibleSymbols.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleSymbols.map((symbol) => (
              <MarketCard key={symbol} symbol={symbol} state={lookups[symbol]} onRetry={() => void lookup(symbol)} />
            ))}
          </div>
        ) : (
          <Card className="shadow-none">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <CandlestickChart className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">No matching market in this list</p>
              <p className="max-w-md text-muted-foreground text-sm">
                Choose a market above to load observations from its data source.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function MarketCard({ symbol, state, onRetry }: { symbol: string; state?: LookupState; onRetry: () => void }) {
  if (!state || (state.status === "loading" && !state.snapshot)) {
    return (
      <Card className="shadow-none" aria-label={`Loading ${symbol}`}>
        <CardContent className="flex flex-col gap-3 p-4" role="status">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (state.status === "loading") {
    return state.snapshot ? (
      <MarketSnapshotCard symbol={symbol} snapshot={state.snapshot} updating onRetry={onRetry} />
    ) : null;
  }
  if (state.status === "error") {
    return (
      <Card className="border-destructive/30 shadow-none">
        <CardContent className="flex min-h-36 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{symbol}</p>
              <p className="mt-1 text-destructive text-sm">Quote unavailable</p>
            </div>
            <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          </div>
          <p className="line-clamp-2 text-muted-foreground text-xs">{state.message}</p>
          <Button className="mt-auto w-fit" variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <MarketSnapshotCard symbol={symbol} snapshot={state.snapshot} warning={state.warning} onRetry={onRetry} />;
}

function MarketSnapshotCard({
  symbol,
  snapshot,
  updating = false,
  warning,
  onRetry,
}: {
  symbol: string;
  snapshot: Snapshot;
  updating?: boolean;
  warning?: string;
  onRetry: () => void;
}) {
  const catalog = useMarketCatalog();
  const displayName = catalog.data?.instruments.find((item) => item.symbol === symbol)?.name ?? marketName(symbol);
  let freshnessLabel = snapshot.freshness === "fresh" ? "Recent" : "Cached";
  if (updating) freshnessLabel = "Updating";
  const firstOpen = snapshot.data.candles[0]?.open;
  const move = firstOpen ? ((snapshot.data.price - firstOpen) / firstOpen) * 100 : null;
  return (
    <Card className="py-0 shadow-none transition-colors hover:bg-muted/20">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <AssetMark symbol={symbol} />
              <div>
                <p className="font-semibold">{displayName}</p>
                <p className="text-muted-foreground text-xs">{symbol}</p>
              </div>
            </div>
          </div>
          <Badge variant={snapshot.freshness === "fresh" ? "secondary" : "outline"}>{freshnessLabel}</Badge>
        </div>
        <div className="flex flex-col gap-2">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">
              {snapshot.data.priceKind === "candle_close" ? "Candle close" : "Price"} · {symbol.split("-")[1]}
            </p>
            <p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
              {formatPrice(snapshot.data.price)}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <p className="text-muted-foreground">Candle window move</p>
            <p
              className={`font-medium tabular-nums ${move !== null && move >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
            >
              {move === null ? "Unavailable" : `${move >= 0 ? "+" : ""}${move.toFixed(2)}%`}
            </p>
          </div>
        </div>
        <MarketSparkline
          className="h-12"
          values={snapshot.data.candles.slice(-48).map((candle) => candle.close)}
          positive={(move ?? 0) >= 0}
        />
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <Badge variant="outline">
            {snapshot.data.trend ? formatTrend(snapshot.data.trend) : "Trend unavailable"}
          </Badge>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/markets/${encodeURIComponent(symbol)}`}>
              View analysis <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {marketSourceLabel(snapshot.source)} · {snapshot.data.priceKind === "candle_close" ? "Candle" : "Observed"}{" "}
          {new Date(snapshot.data.timestamp).toLocaleString()}
          {snapshot.freshness === "stale" ? " · cached" : ""}
        </p>
        {warning ? (
          <p className="flex flex-wrap items-center justify-between gap-2 text-amber-600 text-xs">
            Latest refresh failed; showing the cached quote.
            <Button variant="link" size="sm" className="h-auto p-0 text-amber-600" onClick={onRetry}>
              Retry
            </Button>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}

function formatTrend(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}
