"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import type { MarketObservation } from "@marketpilot/market-data";
import { ArrowRight, CandlestickChart, CircleAlert, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AssetMark,
  MarketSymbolField,
  marketName,
  normalizeMarketSymbol,
} from "@/app/(main)/dashboard/_components/market-symbol-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { MarketSparkline } from "../../_components/market-sparkline";

type Watchlist = { id: string; name: string; items: { id: string; assetId: string }[] };
type MarketSnapshot = { data: MarketObservation; freshness: "fresh" | "stale"; fetchedAt: string };
type SnapshotState =
  | { status: "loading"; snapshot?: MarketSnapshot }
  | { status: "ready"; snapshot: MarketSnapshot; warning?: string }
  | { status: "error"; message: string };

export function WatchlistManager() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"symbol" | "price-desc" | "change-desc">("symbol");
  const [addQuery, setAddQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const lastSnapshotRequest = useRef(0);
  const current = watchlists[0];
  const items = current?.items ?? [];
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadWatchlists = useCallback(async () => {
    try {
      const { data } = await apiRequest<ApiEnvelope<Watchlist[]>>("/watchlists");
      setWatchlists(data);
      setError(null);
      return data[0]?.items ?? [];
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your watchlist.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSnapshots = useCallback(async (assets: Watchlist["items"]) => {
    if (!assets.length) return;
    lastSnapshotRequest.current = Date.now();
    setSnapshots((currentSnapshots) => {
      const next = { ...currentSnapshots };
      for (const { assetId } of assets) {
        const existing = next[assetId];
        const snapshot = existing && existing.status !== "error" ? existing.snapshot : undefined;
        next[assetId] = { status: "loading", snapshot };
      }
      return next;
    });
    const results = await Promise.allSettled(
      assets.map(async ({ assetId }) => {
        const { data } = await apiRequest<ApiEnvelope<MarketSnapshot>>(
          `/market-data/${encodeURIComponent(assetId)}?interval=15m`,
        );
        return [assetId, data] as const;
      }),
    );
    setSnapshots((currentSnapshots) => {
      const next = { ...currentSnapshots };
      results.forEach((result, index) => {
        const symbol = assets[index].assetId;
        if (result.status === "fulfilled") {
          next[symbol] = { status: "ready", snapshot: result.value[1] };
        } else {
          const previous = next[symbol];
          next[symbol] =
            previous?.status === "loading" && previous.snapshot
              ? {
                  status: "ready",
                  snapshot: { ...previous.snapshot, freshness: "stale" },
                  warning: "Latest refresh failed.",
                }
              : {
                  status: "error",
                  message: result.reason instanceof Error ? result.reason.message : "Market data unavailable.",
                };
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    const initial = async () => {
      const assets = await loadWatchlists();
      if (!disposed && assets) await loadSnapshots(assets);
    };
    void initial();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && itemsRef.current.length) void loadSnapshots(itemsRef.current);
    }, 65_000);
    const resume = () => {
      if (
        document.visibilityState === "visible" &&
        itemsRef.current.length &&
        Date.now() - lastSnapshotRequest.current >= 65_000
      )
        void loadSnapshots(itemsRef.current);
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [loadSnapshots, loadWatchlists]);

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => item.assetId.toLowerCase().includes(query.trim().toLowerCase()))
        .toSorted((left, right) => {
          const leftSnapshot = snapshots[left.assetId];
          const rightSnapshot = snapshots[right.assetId];
          const leftData = leftSnapshot?.status === "ready" ? leftSnapshot.snapshot.data : null;
          const rightData = rightSnapshot?.status === "ready" ? rightSnapshot.snapshot.data : null;
          if (sort === "price-desc") return (rightData?.price ?? -Infinity) - (leftData?.price ?? -Infinity);
          if (sort === "change-desc") return (getMove(rightData) ?? -Infinity) - (getMove(leftData) ?? -Infinity);
          return left.assetId.localeCompare(right.assetId);
        }),
    [items, query, snapshots, sort],
  );

  const addAsset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const symbol = normalizeMarketSymbol(addQuery);
    if (!current || !symbol || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      // Verify the product against the configured provider before saving it to the account.
      const { data: snapshot } = await apiRequest<ApiEnvelope<MarketSnapshot>>(
        `/market-data/${encodeURIComponent(symbol)}?interval=15m`,
      );
      const { data: item } = await apiRequest<ApiEnvelope<{ id: string; assetId: string }>>(
        `/watchlists/${current.id}/items`,
        { method: "POST", body: JSON.stringify({ assetId: snapshot.data.symbol }) },
      );
      setWatchlists((previous) =>
        previous.map((list) => (list.id === current.id ? { ...list, items: [...list.items, item] } : list)),
      );
      setSnapshots((previous) => ({ ...previous, [item.assetId]: { status: "ready", snapshot } }));
      setAddQuery("");
      toast.success(`${item.assetId} added to your watchlist.`);
    } catch (reason) {
      setAddError(reason instanceof Error ? reason.message : "This market could not be verified.");
    } finally {
      setAdding(false);
    }
  };

  const removeAsset = async (itemId: string, symbol: string) => {
    if (!current) return;
    try {
      await apiRequest(`/watchlists/${current.id}/items/${itemId}`, { method: "DELETE" });
      setWatchlists((previous) =>
        previous.map((list) =>
          list.id === current.id ? { ...list, items: list.items.filter((item) => item.id !== itemId) } : list,
        ),
      );
      setSnapshots((previous) => {
        const next = { ...previous };
        delete next[symbol];
        return next;
      });
      toast.success(`${symbol} removed from your watchlist.`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not remove the market.");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{current?.name ?? "Your watchlist"}</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading saved markets…"
                  : `${items.length} ${items.length === 1 ? "market" : "markets"} · prices refresh automatically`}
              </CardDescription>
            </div>
            {items.length ? <Badge variant="outline">Market observations</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addAsset}>
            <FieldGroup className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field className="sm:max-w-sm">
                <FieldLabel htmlFor="watchlist-add">Follow a market</FieldLabel>
                <MarketSymbolField
                  id="watchlist-add"
                  value={addQuery}
                  onChange={setAddQuery}
                  placeholder="Choose an asset to follow"
                  excluded={items.map((item) => item.assetId)}
                  disabled={!current || adding}
                />
              </Field>
              <Button type="submit" className="h-10 shrink-0" disabled={!current || !addQuery || adding}>
                <Plus data-icon="inline-start" /> {adding ? "Adding…" : "Add to watchlist"}
              </Button>
            </FieldGroup>
          </form>
          {addError ? (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
              role="alert"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <p>{addError}</p>
            </div>
          ) : null}
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 p-3 text-sm" role="alert">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <div className="flex-1">
                <p>{error}</p>
                <Button variant="link" className="h-auto p-0" onClick={() => void loadWatchlists()}>
                  Try again
                </Button>
              </div>
            </div>
          ) : null}
          {loading ? (
            <div className="p-6 text-center text-muted-foreground text-sm" role="status">
              Loading your markets…
            </div>
          ) : null}
          {!loading && !error && items.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <CandlestickChart className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Your watchlist is ready for its first market</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Search by asset name in the menu above. Your saved markets will appear here with prices and charts.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/markets">
                  Explore markets <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {items.length > 0 ? (
        <Card className="shadow-none">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">Market list</CardTitle>
              <CardDescription>Live prices and moves over the returned 15 minute candle window.</CardDescription>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter markets"
                  aria-label="Filter watchlist"
                  className="pl-9"
                />
              </div>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                aria-label="Sort watchlist"
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="symbol">Symbol A–Z</option>
                <option value="price-desc">Price: high to low</option>
                <option value="change-desc">Move: high to low</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {visibleItems.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Market</TableHead>
                      <TableHead>Latest price</TableHead>
                      <TableHead>Window move</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead className="hidden lg:table-cell">Recent history</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((item) => {
                      const snapshot = snapshots[item.assetId];
                      const ready = snapshot?.status === "ready" ? snapshot.snapshot : null;
                      const move = ready ? getMove(ready.data) : null;
                      let priceContent: React.ReactNode = "Loading…";
                      if (ready) priceContent = `${formatPrice(ready.data.price)} ${ready.data.symbol.split("-")[1]}`;
                      else if (snapshot?.status === "error")
                        priceContent = <span title={snapshot.message}>Unavailable</span>;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/markets/${encodeURIComponent(item.assetId)}`}
                              className="font-medium hover:underline"
                            >
                              <span className="flex items-center gap-2">
                                <AssetMark symbol={item.assetId} small />
                                {marketName(item.assetId)}{" "}
                                <span className="text-muted-foreground text-xs">{item.assetId}</span>
                              </span>
                            </Link>
                            <p className="mt-0.5 text-muted-foreground text-xs">
                              {ready
                                ? `Observed ${new Date(ready.data.timestamp).toLocaleTimeString()}${ready.freshness === "stale" ? " · cached" : ""}${snapshot?.status === "ready" && snapshot.warning ? " · refresh failed" : ""}`
                                : "Waiting for market data"}
                            </p>
                          </TableCell>
                          <TableCell className="font-medium tabular-nums">{priceContent}</TableCell>
                          <TableCell className="tabular-nums">
                            {move === null ? "—" : <Change value={move} />}
                          </TableCell>
                          <TableCell>
                            {ready?.data.trend ? <Badge variant="outline">{formatTrend(ready.data.trend)}</Badge> : "—"}
                          </TableCell>
                          <TableCell className="hidden w-32 lg:table-cell">
                            {ready ? (
                              <MarketSparkline
                                className="h-8"
                                values={ready.data.candles.slice(-48).map((candle) => candle.close)}
                                positive={(move ?? 0) >= 0}
                              />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void removeAsset(item.id, item.assetId)}
                              aria-label={`Remove ${item.assetId} from your watchlist`}
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="p-6 text-center text-muted-foreground text-sm">No saved markets match “{query}”.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function getMove(data?: MarketObservation | null) {
  const firstOpen = data?.candles[0]?.open;
  return data && firstOpen ? ((data.price - firstOpen) / firstOpen) * 100 : null;
}

function Change({ value }: { value: number }) {
  return (
    <span className={value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 1 ? 8 : 4 }).format(value);
}

function formatTrend(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}
