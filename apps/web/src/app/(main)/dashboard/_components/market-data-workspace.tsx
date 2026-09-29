"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AlertCircle, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest, type ApiEnvelope } from "@/lib/api/client";
import type { MarketDataInterval, MarketObservation } from "@marketpilot/market-data";

import { MarketPilotPage } from "./marketpilot-page";
import { PriceHistoryChart } from "./price-history-chart";

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

export function MarketDataWorkspace({ title, description, initialSymbol = "BTC-USD", mode = "overview" }: Props) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [draft, setDraft] = useState(initialSymbol);
  const [interval, setInterval] = useState<MarketDataInterval>("15m");
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<ApiEnvelope<MarketSnapshot>>(
        `/market-data/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}`,
      );
      setSnapshot(response.data);
    } catch (caught) {
      setSnapshot(null);
      setError(caught instanceof Error ? caught.message : "Market data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [interval, symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  const points = useMemo(
    () =>
      (snapshot?.data.candles ?? [])
        .slice()
        .map((candle) => ({ time: formatCandleTime(candle.time, interval), price: candle.close })),
    [interval, snapshot],
  );
  const data = snapshot?.data;
  const relativeChange =
    data?.candles.length && data.candles.length > 1
      ? ((data.price - data.candles[data.candles.length - 1].open) / data.candles[data.candles.length - 1].open) * 100
      : null;

  return (
    <MarketPilotPage title={title} description={description}>
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <form
            className="flex min-w-0 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = draft.trim().toUpperCase();
              if (normalized) setSymbol(normalized);
            }}
          >
            <label className="min-w-0 flex-1 font-medium text-sm" htmlFor="market-symbol">
              Trading pair
              <Input
                id="market-symbol"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="mt-1"
              />
            </label>
            <Button type="submit" className="self-end">
              Load
            </Button>
          </form>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground text-sm" htmlFor="market-interval">
              Candle interval
            </label>
            <select
              id="market-interval"
              value={interval}
              onChange={(event) => setInterval(event.target.value as MarketDataInterval)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {["1m", "5m", "15m", "1h", "6h", "1d"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh market data"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground" role="status">
            Loading verified Coinbase Exchange data…
          </CardContent>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-destructive/40 shadow-none">
          <CardContent className="flex items-start gap-3 p-5" role="alert">
            <AlertCircle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-medium">Market data unavailable</p>
              <p className="mt-1 text-muted-foreground text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {!loading && !error && !data ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No Coinbase Exchange observation is available for this symbol.
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Latest price"
              value={formatPrice(data.price)}
              detail={`${data.symbol} · ${data.interval}`}
            />
            <MetricCard
              label="Candle move"
              value={
                relativeChange === null
                  ? "Unavailable"
                  : `${relativeChange >= 0 ? "+" : ""}${relativeChange.toFixed(2)}%`
              }
              detail="First to latest candle in returned set"
            />
            <MetricCard
              label="Trend"
              value={data.trend ?? "Insufficient history"}
              detail="Calculated from validated candles"
            />
            <MetricCard label="Sentiment" value="Unavailable" detail="No verified sentiment source is configured" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Price history</CardTitle>
                <CardDescription>
                  {data.candles.length} Coinbase Exchange candles · interval {data.interval}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {points.length ? (
                  <PriceHistoryChart data={points} />
                ) : (
                  <p className="text-muted-foreground text-sm">No candles returned.</p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Technical indicators</CardTitle>
                <CardDescription>Calculated from Coinbase Exchange candles</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <Indicator label="RSI" value={data.indicators.rsi} />
                <Indicator
                  label="MACD"
                  value={
                    data.indicators.macd
                      ? `${data.indicators.macd.value} · signal ${data.indicators.macd.signal}`
                      : null
                  }
                />
                <Indicator label="SMA 50" value={data.indicators.sma50} />
                <Indicator label="SMA 200" value={data.indicators.sma200} />
                <Indicator
                  label="Bollinger bands"
                  value={
                    data.indicators.bollingerBands
                      ? `${data.indicators.bollingerBands.lower} – ${data.indicators.bollingerBands.upper}`
                      : null
                  }
                />
                <Indicator label="ATR" value={data.indicators.atr} />
                <Indicator label="Market open" value={data.marketStatus.isOpen ? "Yes" : "No"} />
              </CardContent>
            </Card>
          </div>

          {mode === "analytics" ? (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Signal summary</CardTitle>
                <CardDescription>Derived from this provider observation</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Support levels"
                  value={data.supportResistance?.support.join(", ") || "Unavailable"}
                  detail="Coinbase Exchange response"
                />
                <MetricCard
                  label="Resistance levels"
                  value={data.supportResistance?.resistance.join(", ") || "Unavailable"}
                  detail="Coinbase Exchange response"
                />
                <MetricCard
                  label="Volatility ATR"
                  value={data.volatility.atrPercentage?.toFixed(2) ?? "Unavailable"}
                  detail="ATR as a percentage of price"
                />
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-none">
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Data provenance</CardTitle>
                <CardDescription>Provider timestamp and MarketPilot cache metadata.</CardDescription>
              </div>
              <Badge variant={snapshot?.freshness === "fresh" ? "secondary" : "outline"}>
                {snapshot?.freshness === "fresh" ? "Recent MarketPilot retrieval" : "Stale MarketPilot cache"}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Source</p>
                <p className="mt-1 font-medium">Coinbase Exchange</p>
              </div>
              <div>
                <p className="text-muted-foreground">Provider timestamp</p>
                <p className="mt-1 font-medium">{new Date(data.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Retrieved</p>
                <p className="mt-1 font-medium">
                  {snapshot ? new Date(snapshot.fetchedAt).toLocaleString() : "Unavailable"}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </MarketPilotPage>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="mt-2 break-all font-semibold text-xl tracking-tight">{value}</p>
        <p className="mt-1 text-muted-foreground text-xs">{detail}</p>
      </CardContent>
    </Card>
  );
}

function Indicator({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="flex justify-between gap-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">
        {value === null
          ? "Unavailable"
          : typeof value === "number"
            ? value.toLocaleString(undefined, { maximumFractionDigits: 6 })
            : value}
      </span>
    </div>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 1 ? 8 : 4 }).format(value);
}

function formatCandleTime(value: string, interval: MarketDataInterval) {
  const timestamp = new Date(value);
  return ["1m", "5m", "15m", "1h", "6h"].includes(interval)
    ? timestamp.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : timestamp.toLocaleDateString();
}
