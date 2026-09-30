"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { ArrowRight, BellRing, CandlestickChart, CircleAlert, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { MarketRow, PulseCard, type Snapshot, SummaryCard } from "./overview-cards";
import { OverviewHeadlines, type OverviewNews } from "./overview-headlines";
import { OverviewMarketHistory } from "./overview-market-history";

type Watchlist = { id: string; name: string; items: Array<{ id: string; assetId: string }> };
type AlertRule = { id: string; enabled: boolean };

const refreshInterval = 65_000;
const marketPulseSymbols = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD"];

export function DashboardOverview() {
  const [chartSymbol, setChartSymbol] = useState("BTC-USD");
  const [watchlists, setWatchlists] = useState<Watchlist[] | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot | null>>({});
  const [news, setNews] = useState<OverviewNews | null>(null);
  const [alerts, setAlerts] = useState<AlertRule[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const lastAttempt = useRef(0);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastAttempt.current = Date.now();

    try {
      const [watchlistResult, newsResult, alertsResult] = await Promise.allSettled([
        apiRequest<ApiEnvelope<Watchlist[]>>("/watchlists"),
        apiRequest<ApiEnvelope<OverviewNews>>("/news?page=1&pageSize=6"),
        apiRequest<ApiEnvelope<AlertRule[]>>("/alerts"),
      ]);

      const nextErrors: string[] = [];
      let lists: Watchlist[] | null = null;
      if (watchlistResult.status === "fulfilled") {
        lists = watchlistResult.value.data;
        setWatchlists(lists);
      } else nextErrors.push("watchlist");
      if (newsResult.status === "fulfilled") setNews(newsResult.value.data);
      else nextErrors.push("news");
      if (alertsResult.status === "fulfilled") setAlerts(alertsResult.value.data);
      else nextErrors.push("alerts");

      const trackedSymbols = lists?.[0]?.items.slice(0, 8).map((item) => item.assetId) ?? [];
      const symbols = [...new Set([...marketPulseSymbols, ...trackedSymbols])];
      const marketResults = await Promise.allSettled(
        symbols.map(async (symbol) => {
          const { data } = await apiRequest<ApiEnvelope<Snapshot>>(
            `/market-data/${encodeURIComponent(symbol)}?interval=15m`,
          );
          return [symbol, data] as const;
        }),
      );
      let hasMarketError = false;
      marketResults.forEach((result, index) => {
        if (result.status === "fulfilled") return;

        hasMarketError = true;
        if (trackedSymbols.includes(symbols[index])) nextErrors.push(`market data (${symbols[index]})`);
      });
      setSnapshots((previous) => {
        const next = { ...previous };
        marketResults.forEach((result, index) => {
          if (result.status === "fulfilled") next[result.value[0]] = result.value[1];
          else {
            const previous = next[symbols[index]];
            next[symbols[index]] = previous ? { ...previous, freshness: "stale" } : null;
          }
        });
        return next;
      });
      if (hasMarketError && nextErrors.length === 0) nextErrors.push("market quotes");
      setErrors(nextErrors);
      if (nextErrors.length === 0) setLastChecked(new Date());
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, refreshInterval);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt.current >= refreshInterval) void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const current = watchlists?.[0];
  const items = current?.items ?? [];
  const snapshotsAreStale = Object.values(snapshots).some((snapshot) => snapshot?.freshness === "stale");
  const stale =
    !lastChecked || Date.now() - lastChecked.getTime() > refreshInterval * 2 || errors.length > 0 || snapshotsAreStale;

  const unavailableValue = loading ? "…" : "Unavailable";
  let freshnessLabel = loading ? "Updating your overview…" : "Waiting for data";
  if (lastChecked) {
    const prefix = stale ? "Cached or partially updated · checked" : "Checked automatically";
    freshnessLabel = `${prefix} ${lastChecked.toLocaleTimeString()}`;
  }
  const chartSnapshot = snapshots[chartSymbol];

  return (
    <div className="@container/main mx-auto flex w-full max-w-screen-2xl flex-col gap-5 md:gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-primary text-sm">MARKETPILOT</p>
          <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">Market overview</h1>
          <p className="max-w-3xl text-muted-foreground text-sm">
            Your saved markets, the latest headlines, and the signals you follow.
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs" aria-live="polite">
          <span className={`size-2 rounded-full ${stale ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden="true" />
          {freshnessLabel}
        </div>
      </header>

      {errors.length > 0 ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
          role="status"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>
            Some data could not be refreshed. Showing the latest available results; MarketPilot will retry
            automatically.
          </p>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Account overview">
        <SummaryCard
          href="/dashboard/watchlist"
          label="Markets followed"
          value={loading ? "…" : String(items.length)}
          detail={current?.name ?? "Add markets to build your watchlist"}
          icon={CandlestickChart}
        />
        <SummaryCard
          href="/dashboard/news-and-sentiment"
          label="Market headlines"
          value={news ? String(news.total) : unavailableValue}
          detail="Browse the latest market coverage"
          icon={Newspaper}
        />
        <SummaryCard
          href="/dashboard/alerts"
          label="Saved alerts"
          value={alerts ? String(alerts.length) : unavailableValue}
          detail={alerts?.length ? "Your saved market conditions" : "Save a price condition to revisit"}
          icon={BellRing}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="market-pulse-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="market-pulse-title" className="font-semibold text-lg tracking-tight">
              Market pulse
            </h2>
            <p className="text-muted-foreground text-sm">
              Follow the market at a glance. Moves cover the returned candle history.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/markets">
              Explore markets <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {marketPulseSymbols.map((symbol) => (
            <PulseCard key={symbol} symbol={symbol} snapshot={snapshots[symbol]} loading={loading} />
          ))}
        </div>
      </section>

      <section
        aria-label="Market research"
        className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]"
      >
        <OverviewMarketHistory
          symbol={chartSymbol}
          symbols={marketPulseSymbols}
          onSymbolChange={setChartSymbol}
          snapshot={chartSnapshot}
          loading={loading}
        />
        <OverviewHeadlines news={news} loading={loading} />
      </section>

      <Card className="min-w-0 shadow-none">
        <CardHeader className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Your watchlist</CardTitle>
            <CardDescription>Recent Coinbase Exchange observations for your saved markets.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/watchlist">
              View all <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loading && watchlists === null ? (
            <div className="grid gap-3 px-4 sm:px-0" role="status" aria-label="Loading watchlist">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {!loading && watchlists === null ? (
            <div
              className="mx-4 rounded-lg border border-dashed p-4 text-muted-foreground text-sm sm:mx-0"
              role="status"
            >
              Watchlist data is unavailable. MarketPilot will try again automatically.
            </div>
          ) : null}
          {watchlists !== null && items.length === 0 ? (
            <div className="mx-4 flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:mx-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                  <CandlestickChart className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-sm">Start with a market you follow</p>
                  <p className="mt-1 text-muted-foreground text-sm">Save it once to see live prices and trends here.</p>
                </div>
              </div>
              <Button size="sm" asChild>
                <Link href="/dashboard/markets">Browse markets</Link>
              </Button>
            </div>
          ) : null}
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Window move</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, 6).map((item) => (
                    <MarketRow
                      key={item.id}
                      symbol={item.assetId}
                      snapshot={snapshots[item.assetId]}
                      loading={loading}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
