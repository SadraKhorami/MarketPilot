"use client";
import Link from "next/link";
import type { MarketObservation } from "@marketpilot/market-data";
import { Trash2 } from "lucide-react";
import { AssetMark, marketName } from "../../_components/market-symbol-field";
import { MarketSparkline } from "../../_components/market-sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type MarketSnapshot = { data: MarketObservation; freshness: "fresh" | "stale"; fetchedAt: string };
export type SnapshotState =
  | { status: "loading"; snapshot?: MarketSnapshot }
  | { status: "ready"; snapshot: MarketSnapshot; warning?: string }
  | { status: "error"; message: string };

export function WatchlistMarketTable({
  items,
  snapshots,
  removing,
  removeAsset,
}: {
  items: Array<{ id: string; assetId: string }>;
  snapshots: Record<string, SnapshotState>;
  removing: string[];
  removeAsset: (id: string, symbol: string) => Promise<void>;
}) {
  return (
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
          {items.map((item) => {
            const snapshot = snapshots[item.assetId];
            const ready = snapshot && snapshot.status !== "error" ? snapshot.snapshot : null;
            const move = ready ? getMove(ready.data) : null;
            let priceContent: React.ReactNode = "Loading…";
            if (ready) priceContent = `${formatPrice(ready.data.price)} ${ready.data.symbol.split("-")[1]}`;
            else if (snapshot?.status === "error") priceContent = <span title={snapshot.message}>Unavailable</span>;
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/markets/${encodeURIComponent(item.assetId)}`}
                    className="font-medium hover:underline"
                  >
                    <span className="flex items-center gap-2">
                      <AssetMark symbol={item.assetId} small />
                      {marketName(item.assetId)} <span className="text-muted-foreground text-xs">{item.assetId}</span>
                    </span>
                  </Link>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {ready
                      ? `Observed ${new Date(ready.data.timestamp).toLocaleTimeString()}${ready.freshness === "stale" ? " · cached" : ""}${snapshot?.status === "loading" ? " · checking" : ""}${snapshot?.status === "ready" && snapshot.warning ? " · refresh failed" : ""}`
                      : "Waiting for market data"}
                  </p>
                </TableCell>
                <TableCell className="font-medium tabular-nums">{priceContent}</TableCell>
                <TableCell className="tabular-nums">{move === null ? "—" : <Change value={move} />}</TableCell>
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
                    disabled={removing.includes(item.id)}
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
  );
}

export function getMove(data?: MarketObservation | null) {
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
