"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import type { MarketDataInterval, MarketObservation } from "@marketpilot/market-data";
import { ArrowLeft, ArrowUpRight, CircleAlert } from "lucide-react";

import { MarketSymbolField } from "@/app/(main)/dashboard/_components/market-symbol-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { MarketHistoryPanel } from "./market-history-panel";
import { MarketPilotPage } from "./marketpilot-page";
import { MomentumPanel } from "./momentum-panel";

interface MarketSnapshot {
  source: string;
  requestedSymbol: string;
  data: MarketObservation;
  freshness: "fresh" | "stale";
  fetchedAt: string;
}

interface Props {
  title: string;
  description: string;
  initialSymbol?: string;
  mode?: "overview" | "analytics" | "watchlist";
}

const intervals: MarketDataInterval[] = ["1m", "5m", "15m", "1h", "6h", "1d"];

export function MarketDataWorkspace({ title, description, initialSymbol = "BTC-USD", mode = "overview" }: Props) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [interval, setInterval] = useState<MarketDataInterval>("15m");
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastAttempt = useRef(0);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    lastAttempt.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiRequest<ApiEnvelope<MarketSnapshot>>(
        `/market-data/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}`,
      );
      if (version === requestVersion.current) setSnapshot(data);
    } catch (reason) {
      if (version === requestVersion.current)
        setError(reason instanceof Error ? reason.message : "Market data is unavailable.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [interval, symbol]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 65_000);
    const resume = () => {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt.current >= 65_000) void load();
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      requestVersion.current++;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [load]);

  const data = snapshot?.data;
  const firstCandleOpen = data?.candles[0]?.open;
  const relativeChange = data && firstCandleOpen ? ((data.price - firstCandleOpen) / firstCandleOpen) * 100 : null;
  const fetchedAt = snapshot ? new Date(snapshot.fetchedAt) : null;
  const isStale =
    snapshot?.freshness === "stale" ||
    Boolean(fetchedAt && Date.now() - fetchedAt.getTime() > 90_000) ||
    Boolean(error);

  return (
    <MarketPilotPage title={title} description={description}>
      <Card>
        <CardContent>
          <FieldGroup className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <Field className="sm:max-w-sm">
              <FieldLabel htmlFor="market-symbol">Market</FieldLabel>
              <MarketSymbolField
                id="market-symbol"
                value={symbol}
                onChange={(value) => {
                  setSnapshot(null);
                  setSymbol(value);
                }}
              />
            </Field>
            <Field className="sm:w-auto">
              <FieldLabel id="interval-label">Candle interval</FieldLabel>
              <ToggleGroup
                type="single"
                value={interval}
                onValueChange={(value) => {
                  if (value) {
                    setSnapshot(null);
                    setInterval(value as MarketDataInterval);
                  }
                }}
                variant="outline"
                spacing={0}
                aria-labelledby="interval-label"
                className="max-w-full overflow-x-auto"
              >
                {intervals.map((value) => (
                  <ToggleGroupItem key={value} value={value} className="px-3">
                    {value}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {loading && !data ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm" role="status">
            Loading verified Coinbase Exchange data…
          </CardContent>
        </Card>
      ) : null}
      {error ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
          role="status"
        >
          <CircleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            {data ? "The latest refresh failed; the previous market observation is still shown." : error}
          </p>
          {!data ? (
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && !data ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No Coinbase Exchange observation is available for this market.
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Market summary">
            <MetricCard label="Latest price" value={formatPrice(data.price, data.symbol)} detail={data.symbol} />
            <MetricCard
              label="History window move"
              value={formatChange(relativeChange)}
              detail="First candle open to latest price"
              change={relativeChange}
            />
            <MetricCard
              label="Trend"
              value={data.trend ? formatTrend(data.trend) : "Unavailable"}
              detail="Calculated from validated candles"
            />
            <MetricCard
              label="ATR volatility"
              value={
                data.volatility.atrPercentage === null ? "Unavailable" : `${data.volatility.atrPercentage.toFixed(2)}%`
              }
              detail="Average range relative to price"
            />
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
            <MarketHistoryPanel data={data} stale={isStale} />
            <div className="flex min-w-0 flex-col gap-4">
              <MomentumPanel data={data} />

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Signals and key levels</CardTitle>
                  <CardDescription>Derived from candle history.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y">
                  <Indicator
                    label="MACD"
                    value={
                      data.indicators.macd
                        ? `${formatPrice(data.indicators.macd.value, data.symbol)} · signal ${formatPrice(data.indicators.macd.signal, data.symbol)}`
                        : null
                    }
                  />
                  <Indicator
                    label="50 period average"
                    value={data.indicators.sma50 === null ? null : formatPrice(data.indicators.sma50, data.symbol)}
                  />
                  <Indicator
                    label="200 period average"
                    value={data.indicators.sma200 === null ? null : formatPrice(data.indicators.sma200, data.symbol)}
                  />
                  <Indicator
                    label="Support"
                    value={
                      data.supportResistance.support.length
                        ? data.supportResistance.support.map((value) => formatPrice(value, data.symbol)).join(" · ")
                        : null
                    }
                  />
                  <Indicator
                    label="Resistance"
                    value={
                      data.supportResistance.resistance.length
                        ? data.supportResistance.resistance.map((value) => formatPrice(value, data.symbol)).join(" · ")
                        : null
                    }
                  />
                  <Indicator
                    label="Average true range"
                    value={data.indicators.atr === null ? null : formatPrice(data.indicators.atr, data.symbol)}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-muted-foreground text-xs">
            <span>Source: Coinbase Exchange · Provider observation {new Date(data.timestamp).toLocaleString()}</span>
            <span>
              Retrieved {fetchedAt?.toLocaleTimeString() ?? "Unavailable"}
              {snapshot?.freshness === "stale" || isStale ? " · Cached" : ""}
              {loading ? " · Checking for updates" : ""}
            </span>
          </div>
          {mode === "analytics" ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/markets/${encodeURIComponent(data.symbol)}`}>
                  <ArrowUpRight data-icon="inline-start" /> Market details
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/watchlist">
                  <ArrowLeft data-icon="inline-start" /> Back to watchlist
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </MarketPilotPage>
  );
}

function MetricCard({
  label,
  value,
  detail,
  change,
}: {
  label: string;
  value: string;
  detail: string;
  change?: number | null;
}) {
  let valueClass = "";
  if (change !== undefined && change !== null) valueClass = change >= 0 ? "text-emerald-600" : "text-rose-500";
  return (
    <Card className="py-0 shadow-none">
      <CardContent className="p-4">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className={`mt-2 break-words font-semibold text-xl tabular-nums tracking-tight sm:text-2xl ${valueClass}`}>
          {value}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">{detail}</p>
      </CardContent>
    </Card>
  );
}

function Indicator({ label, value }: { label: string; value: number | string | null }) {
  let display = value ?? "Unavailable";
  if (typeof value === "number") display = value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return (
    <div className="flex justify-between gap-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{display}</span>
    </div>
  );
}

function formatPrice(value: number, symbol: string) {
  const currency = symbol.split("-").at(-1);
  return new Intl.NumberFormat(undefined, {
    style: currency ? "currency" : "decimal",
    currency,
    maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
  }).format(value);
}

function formatChange(value: number | null) {
  return value === null ? "Unavailable" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTrend(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}
