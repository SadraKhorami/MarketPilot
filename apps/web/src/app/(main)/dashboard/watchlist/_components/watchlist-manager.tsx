"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ArrowDownAZ, ArrowUpRight, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { defaultWatchlist, demoAssets, findAsset, formatPrice } from "@/data/marketpilot";

import { ChangeText, FixtureNote, StatusBadge } from "../../_components/marketpilot-page";

type SortMode = "symbol" | "price-desc" | "change-desc";

export function WatchlistManager() {
  const [symbols, setSymbols] = useState<string[]>(defaultWatchlist);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("symbol");
  const [addSymbol, setAddSymbol] = useState("");

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

  const addAsset = () => {
    if (!candidates.some((asset) => asset.symbol === addSymbol)) return;
    setSymbols((current) => [...current, addSymbol]);
    setAddSymbol("");
    toast.success("Asset added to this temporary watchlist.");
  };

  const removeAsset = (symbol: string) => {
    setSymbols((current) => current.filter((item) => item !== symbol));
    toast.info(`${symbol} removed from this temporary watchlist.`);
  };

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
            <Button onClick={addAsset} disabled={!addSymbol}>
              <Plus /> Add asset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Main watchlist</CardTitle>
            <CardDescription>{symbols.length} assets · temporary local state</CardDescription>
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
                    {shownAssets.map((asset) => (
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
                            onClick={() => removeAsset(asset.symbol)}
                            aria-label={`Remove ${asset.name} from watchlist`}
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardContent className="grid gap-3 sm:hidden">
              {shownAssets.map((asset) => (
                <div key={asset.symbol} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/markets/${asset.symbol}`} className="font-medium hover:underline">
                      {asset.name} <span className="text-muted-foreground">{asset.symbol}</span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAsset(asset.symbol)}
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
              ))}
            </CardContent>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
          <FixtureNote />
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
