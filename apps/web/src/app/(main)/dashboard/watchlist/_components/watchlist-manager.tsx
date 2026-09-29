"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, type ApiEnvelope } from "@/lib/api/client";
import type { MarketObservation } from "@marketpilot/market-data";

type Watchlist = { id: string; name: string; items: { id: string; assetId: string }[] };
type MarketSnapshot = { data: MarketObservation; freshness: "fresh" | "stale" };

export function WatchlistManager() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requestedSymbols = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"symbol" | "price-desc" | "change-desc">("symbol");
  const [addSymbol, setAddSymbol] = useState("");
  const current = watchlists[0];
  const items = current?.items ?? [];

  const loadWatchlists = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiRequest<ApiEnvelope<Watchlist[]>>("/watchlists");
      setWatchlists(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load watchlists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWatchlists();
  }, [loadWatchlists]);
  const loadMarketData = useCallback((assets: Watchlist["items"]) => {
    for (const item of assets) {
      if (requestedSymbols.current.has(item.assetId)) continue;
      requestedSymbols.current.add(item.assetId);
      apiRequest<ApiEnvelope<MarketSnapshot>>(`/market-data/${encodeURIComponent(item.assetId)}?interval=15m`)
        .then(({ data }) => {
          setSnapshots((previous) => ({ ...previous, [item.assetId]: data }));
        })
        .catch((error: unknown) => {
          requestedSymbols.current.delete(item.assetId);
          setSnapshots((previous) => ({ ...previous, [item.assetId]: null }));
          setErrors((previous) => ({
            ...previous,
            [item.assetId]: error instanceof Error ? error.message : "Unavailable",
          }));
        });
    }
  }, []);
  useEffect(() => loadMarketData(items), [items, loadMarketData]);

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => item.assetId.toLowerCase().includes(query.trim().toLowerCase()))
        .toSorted((left, right) => {
          if (sort === "price-desc")
            return (
              (snapshots[right.assetId]?.data.price ?? -Infinity) - (snapshots[left.assetId]?.data.price ?? -Infinity)
            );
          if (sort === "change-desc") {
            const change = (symbol: string) => {
              const data = snapshots[symbol]?.data;
              const firstOpen = data?.candles.at(-1)?.open;
              return data && firstOpen ? ((data.price - firstOpen) / firstOpen) * 100 : -Infinity;
            };
            return change(right.assetId) - change(left.assetId);
          }
          return left.assetId.localeCompare(right.assetId);
        }),
    [items, query, snapshots, sort],
  );

  const addAsset = async () => {
    const symbol = addSymbol.trim().toUpperCase();
    if (!current || !symbol) return;
    try {
      const { data } = await apiRequest<ApiEnvelope<{ id: string; assetId: string }>>(
        `/watchlists/${current.id}/items`,
        {
          method: "POST",
          body: JSON.stringify({ assetId: symbol }),
        },
      );
      setWatchlists((previous) =>
        previous.map((list) => (list.id === current.id ? { ...list, items: [...list.items, data] } : list)),
      );
      setAddSymbol("");
      toast.success(`${symbol} added to your watchlist.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the symbol.");
    }
  };

  const removeAsset = async (itemId: string, symbol: string) => {
    if (!current) return;
    try {
      await apiRequest(`/watchlists/${current.id}/items/${itemId}`, { method: "DELETE" });
      requestedSymbols.current.delete(symbol);
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the symbol.");
    }
  };

  if (loading)
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground" role="status">
        Loading your watchlist…
      </div>
    );

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="min-w-0 flex-1 font-medium text-sm" htmlFor="watchlist-search">
            Search saved symbols
            <Input
              id="watchlist-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search symbol"
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium" htmlFor="watchlist-sort">
            Sort
            <select
              id="watchlist-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="mt-1 block h-9 rounded-md border bg-background px-2"
            >
              <option value="symbol">Symbol A–Z</option>
              <option value="price-desc">Price: high to low</option>
              <option value="change-desc">Candle move: high to low</option>
            </select>
          </label>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void addAsset();
            }}
          >
            <label className="font-medium text-sm" htmlFor="watchlist-add">
              Coinbase product
              <Input
                id="watchlist-add"
                value={addSymbol}
                onChange={(event) => setAddSymbol(event.target.value)}
                placeholder="BTC-USD"
                className="mt-1 sm:w-52"
              />
            </label>
            <Button type="submit" className="self-end" disabled={!addSymbol.trim() || !current}>
              <Plus /> Add
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{current?.name ?? "Watchlist"}</CardTitle>
          <CardDescription>
            {items.length} saved products · prices and indicators load from Coinbase Exchange
          </CardDescription>
        </CardHeader>
        {visibleItems.length === 0 ? (
          <CardContent>
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">{items.length ? "No matching symbols" : "Your watchlist is empty"}</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Add an exact Coinbase Exchange product identifier, such as BTC-USD.
              </p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Change in returned candles</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Remove</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.map((item) => {
                    const snapshot = snapshots[item.assetId];
                    const response = snapshot?.data;
                    const first = response?.candles.at(-1)?.open;
                    const change = first && response ? ((response.price - first) / first) * 100 : null;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/markets/${encodeURIComponent(item.assetId)}`}
                            className="font-medium hover:underline"
                          >
                            {item.assetId}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          <MarketPriceValue
                            response={response}
                            loading={snapshots[item.assetId] === undefined}
                            error={errors[item.assetId]}
                          />
                        </TableCell>
                        <TableCell>
                          {change === null ? "Unavailable" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
                        </TableCell>
                        <TableCell>
                          {response?.trend ? <Badge variant="outline">{response.trend}</Badge> : "Insufficient data"}
                        </TableCell>
                        <TableCell>Unavailable</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void removeAsset(item.id, item.assetId)}
                            aria-label={`Remove ${item.assetId} from watchlist`}
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
            <div className="flex justify-end border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  requestedSymbols.current.clear();
                  setSnapshots({});
                  setErrors({});
                  loadMarketData(items);
                }}
              >
                Refresh provider data
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function MarketPriceValue({
  response,
  loading,
  error,
}: {
  response?: MarketObservation;
  loading: boolean;
  error?: string;
}) {
  if (response) return formatPrice(response.price);
  if (loading) return <span className="text-muted-foreground">Loading…</span>;
  return (
    <span className="text-muted-foreground" title={error}>
      Unavailable
    </span>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 1 ? 8 : 4 }).format(value);
}
