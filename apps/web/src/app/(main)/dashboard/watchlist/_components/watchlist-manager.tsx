"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { ArrowDownAZ, ArrowUpRight, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoAssets, findAsset, formatPrice } from "@/data/marketpilot";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { ChangeText, FixtureNote, StatusBadge } from "../../_components/marketpilot-page";

type SortMode = "symbol" | "price-desc" | "change-desc";
type WatchlistsResponse = {
  data: Array<{ id: string; name: string; items: Array<{ id: string; assetId: string }> }>;
};

export function WatchlistManager() {
  const [watchlists, setWatchlists] = useState<
    Array<{ id: string; name: string; items: Array<{ id: string; assetId: string }> }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("symbol");
  const [addSymbol, setAddSymbol] = useState("");

  useEffect(() => {
    apiRequest<WatchlistsResponse>("/watchlists")
      .then(({ data }) => {
        setWatchlists(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "Could not load watchlists.");
        setLoading(false);
      });
  }, []);

  const current = watchlists[0];
  const items = current?.items ?? [];
  const symbols = items.map((item) => item.assetId);
  const assets = useMemo(() => symbols.map(findAsset).filter((asset) => asset !== undefined), [symbols]);
  const shownAssets = useMemo(
    () =>
      assets
        .filter((asset) => `${asset.name} ${asset.symbol}`.toLowerCase().includes(query.toLowerCase()))
        .toSorted((left, right) => {
          if (sort === "price-desc") return right.price - left.price;
          if (sort === "change-desc") return right.change24h - left.change24h;
          return left.symbol.localeCompare(right.symbol);
        }),
    [assets, query, sort],
  );
  const candidates = demoAssets.filter((asset) => !symbols.includes(asset.symbol));

  const addAsset = async () => {
    if (!current || !candidates.some((asset) => asset.symbol === addSymbol)) return;
    try {
      const { data } = await apiRequest<ApiEnvelope<{ id: string; assetId: string }>>(
        `/watchlists/${current.id}/items`,
        { method: "POST", body: JSON.stringify({ assetId: addSymbol }) },
      );
      setWatchlists((previous) =>
        previous.map((list) => (list.id === current.id ? { ...list, items: [...list.items, data] } : list)),
      );
      setAddSymbol("");
      toast.success("Asset added to your watchlist.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the asset.");
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
      toast.success(`${symbol} removed from your watchlist.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the asset.");
    }
  };

  if (loading)
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground" role="status">
        Loading your watchlist…
      </div>
    );
  if (loadError)
    return (
      <div className="rounded-lg border border-destructive/40 p-8 text-center text-sm" role="alert">
        {loadError}
      </div>
    );

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by asset or symbol"
                className="pl-9"
                aria-label="Search watchlist"
              />
            </div>
            <Select value={sort} onValueChange={(value) => setSort(value as SortMode)}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Sort watchlist">
                <ArrowDownAZ />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="symbol">Symbol A–Z</SelectItem>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
                <SelectItem value="change-desc">Change: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Select value={addSymbol} onValueChange={setAddSymbol}>
              <SelectTrigger className="min-w-40" aria-label="Choose an asset to add">
                <SelectValue placeholder="Choose asset" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((asset) => (
                  <SelectItem key={asset.symbol} value={asset.symbol}>
                    {asset.symbol} · {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => void addAsset()} disabled={!addSymbol || !current}>
              <Plus /> Add asset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{current?.name ?? "Main watchlist"}</CardTitle>
            <CardDescription>{symbols.length} assets · saved to your account</CardDescription>
          </div>
          <Badge variant="outline">Demo fixtures</Badge>
        </CardHeader>
        {shownAssets.length === 0 ? (
          <CardContent>
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">{symbols.length ? "No matching assets" : "Your watchlist is empty"}</p>
              <p className="mt-1 text-muted-foreground text-sm">
                {symbols.length
                  ? "Try a different search, or add an asset from the sample universe."
                  : "Choose an asset above to start a temporary watchlist."}
              </p>
            </div>
          </CardContent>
        ) : (
          <>
            <CardContent className="hidden px-0 sm:block sm:px-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>24h change</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Remove</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownAssets.map((asset) => {
                      const item = items.find((candidate) => candidate.assetId === asset.symbol);
                      if (!item) return null;
                      return (
                        <TableRow key={asset.symbol}>
                          <TableCell>
                            <Link href={`/dashboard/markets/${asset.symbol}`} className="font-medium hover:underline">
                              {asset.name}
                              <span className="ml-2 text-muted-foreground">{asset.symbol}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums">{formatPrice(asset.price)}</TableCell>
                          <TableCell>
                            <ChangeText value={asset.change24h} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={asset.trend} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={asset.sentiment} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void removeAsset(item.id, asset.symbol)}
                              aria-label={`Remove ${asset.name} from watchlist`}
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
            </CardContent>
            <CardContent className="grid gap-3 sm:hidden">
              {shownAssets.map((asset) => {
                const item = items.find((candidate) => candidate.assetId === asset.symbol);
                if (!item) return null;
                return (
                  <div key={asset.symbol} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/markets/${asset.symbol}`} className="font-medium hover:underline">
                        {asset.name} <span className="text-muted-foreground">{asset.symbol}</span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void removeAsset(item.id, asset.symbol)}
                        aria-label={`Remove ${asset.name} from watchlist`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-end justify-between">
                      <div>
                        <p className="font-semibold tabular-nums">{formatPrice(asset.price)}</p>
                        <ChangeText value={asset.change24h} />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge value={asset.trend} />
                        <StatusBadge value={asset.sentiment} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
          <FixtureNote>Watchlist membership is saved. Market prices and sentiment remain sample fixtures.</FixtureNote>
          <Button variant="link" size="sm" asChild>
            <Link href="/dashboard/markets">
              Browse sample assets <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
