"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CandlestickChart, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import {
  MarketSymbolField,
  marketName,
  normalizeMarketSymbol,
} from "@/app/(main)/dashboard/_components/market-symbol-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { CreateWatchlist } from "./create-watchlist";

import { CollectionPagination } from "../../_components/collection-pagination";
import { getMove, type MarketSnapshot, type SnapshotState, WatchlistMarketTable } from "./watchlist-market-table";

type Watchlist = { id: string; name: string; items: { id: string; assetId: string }[] };

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
  const [selectedId, setSelectedId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const current = watchlists.find((list) => list.id === selectedId) ?? watchlists[0];
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
    void loadWatchlists();
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
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [loadSnapshots, loadWatchlists]);

  const selectedItemsKey = items.map((item) => item.assetId).join(",");
  useEffect(() => {
    if (selectedItemsKey) void loadSnapshots(itemsRef.current);
  }, [selectedItemsKey, loadSnapshots]);
  const resetFilters = () => {
    setQuery("");
    setPage(1);
  };

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) =>
          `${item.assetId} ${marketName(item.assetId)}`.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .toSorted((left, right) => {
          const leftSnapshot = snapshots[left.assetId];
          const rightSnapshot = snapshots[right.assetId];
          const leftData = leftSnapshot && leftSnapshot.status !== "error" ? leftSnapshot.snapshot?.data : null;
          const rightData = rightSnapshot && rightSnapshot.status !== "error" ? rightSnapshot.snapshot?.data : null;
          if (sort === "price-desc") return (rightData?.price ?? -Infinity) - (leftData?.price ?? -Infinity);
          if (sort === "change-desc") return (getMove(rightData) ?? -Infinity) - (getMove(leftData) ?? -Infinity);
          return left.assetId.localeCompare(right.assetId);
        }),
    [items, query, snapshots, sort],
  );

  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleItems.length / pageSize)));
  const pageItems = visibleItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      setAddOpen(false);
      toast.success(`${item.assetId} added to your watchlist.`);
    } catch (reason) {
      setAddError(reason instanceof Error ? reason.message : "This market could not be verified.");
    } finally {
      setAdding(false);
    }
  };

  const removeAsset = async (itemId: string, symbol: string) => {
    if (!current || removing.includes(itemId)) return;
    setRemoving((previous) => [...previous, itemId]);
    try {
      await apiRequest(`/watchlists/${current.id}/items/${itemId}`, { method: "DELETE" });
      setWatchlists((previous) =>
        previous.map((list) =>
          list.id === current.id ? { ...list, items: list.items.filter((item) => item.id !== itemId) } : list,
        ),
      );
      toast.success(`${symbol} removed from your watchlist.`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not remove the market.");
    } finally {
      setRemoving((previous) => previous.filter((id) => id !== itemId));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="min-w-0 shadow-none">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Your watchlists</CardTitle>
              <CardDescription>Organize the markets you follow. Prices refresh automatically.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <CreateWatchlist
                disabled={loading || !!error}
                onCreated={(list) => {
                  setWatchlists((previous) => [...previous, { ...list, items: [] }]);
                  setSelectedId(list.id);
                  resetFilters();
                }}
              />
              <Button
                disabled={!current || loading}
                onClick={() => {
                  setAddError(null);
                  setAddOpen(true);
                }}
              >
                <Plus data-icon="inline-start" />
                Add market
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Select
              value={current?.id ?? ""}
              onValueChange={(id) => {
                setSelectedId(id);
                resetFilters();
              }}
              disabled={loading || !watchlists.length}
            >
              <SelectTrigger className="h-9 w-full sm:w-60" aria-label="Choose your watchlist">
                <SelectValue placeholder="Choose a watchlist" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {watchlists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">
              {items.length} saved {items.length === 1 ? "market" : "markets"}
            </span>
          </div>
          {items.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <InputGroup className="h-9 w-full sm:max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name or symbol"
                  aria-label="Filter watchlist"
                />
              </InputGroup>
              <Select
                value={sort}
                onValueChange={(value) => {
                  if (value === "symbol" || value === "price-desc" || value === "change-desc") {
                    setSort(value);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Sort watchlist">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="symbol">Symbol A–Z</SelectItem>
                    <SelectItem value="price-desc">Price: high to low</SelectItem>
                    <SelectItem value="change-desc">Move: high to low</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {error ? (
            <div role="alert" className="flex items-center justify-between gap-3 px-4 text-destructive">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadWatchlists()}>
                Try again
              </Button>
            </div>
          ) : null}
          {loading ? (
            <p role="status" className="p-6 text-center text-muted-foreground text-sm">
              Loading your saved markets…
            </p>
          ) : null}
          {!loading && !error && !items.length ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <CandlestickChart className="size-6 text-muted-foreground" />
              <p className="font-medium">Follow your first market</p>
              <p className="max-w-sm text-muted-foreground text-sm">
                Add an asset to {current?.name ?? "your watchlist"} to see its price, recent movement and history
                together.
              </p>
              <Button variant="outline" disabled={!current} onClick={() => setAddOpen(true)}>
                Add market
              </Button>
            </div>
          ) : null}
          {items.length > 0 ? (
            <>
              {visibleItems.length ? (
                <WatchlistMarketTable
                  items={pageItems}
                  snapshots={snapshots}
                  removing={removing}
                  removeAsset={removeAsset}
                />
              ) : (
                <p className="p-6 text-center text-muted-foreground text-sm">No saved markets match “{query}”.</p>
              )}
            </>
          ) : null}
        </CardContent>
        {items.length > 0 ? (
          <CollectionPagination
            page={currentPage}
            pageSize={pageSize}
            total={visibleItems.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </Card>
      <Sheet
        open={addOpen}
        onOpenChange={(open) => {
          if (!adding) setAddOpen(open);
        }}
      >
        <SheetContent className="data-[side=right]:w-full sm:max-w-md">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>Add a market</SheetTitle>
            <SheetDescription>
              Follow an asset in {current?.name ?? "your watchlist"}. Existing assets cannot be added twice.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={addAsset} className="space-y-5 px-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="watchlist-add">Market</FieldLabel>
                <MarketSymbolField
                  id="watchlist-add"
                  value={addQuery}
                  onChange={setAddQuery}
                  placeholder="Choose an asset to follow"
                  excluded={items.map((item) => item.assetId)}
                  disabled={!current || adding}
                />
              </Field>
            </FieldGroup>
            {addError ? (
              <p role="alert" className="text-destructive text-sm">
                {addError}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={!current || !addQuery || adding}>
              {adding ? "Adding…" : "Add to watchlist"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
