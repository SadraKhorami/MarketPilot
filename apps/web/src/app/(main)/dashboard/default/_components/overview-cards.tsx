import Link from "next/link";

import type { MarketObservation } from "@marketpilot/market-data";
import type { CandlestickChart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";

import { MarketSparkline } from "../../_components/market-sparkline";
import { AssetMark, marketName } from "../../_components/market-symbol-field";
export type Snapshot = { source: string; freshness: "fresh" | "stale"; fetchedAt: string; data: MarketObservation };
export function SummaryCard({
  href,
  label,
  value,
  detail,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  icon: typeof CandlestickChart;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-sm">{label}</span>
        <span className="truncate text-muted-foreground text-xs">{detail}</span>
      </span>
      <span className="font-semibold text-xl tabular-nums">{value}</span>
    </Link>
  );
}

export function MarketRow({
  symbol,
  snapshot,
  loading,
}: {
  symbol: string;
  snapshot?: Snapshot | null;
  loading: boolean;
}) {
  const candles = snapshot?.data.candles ?? [];
  const firstOpen = candles[0]?.open;
  const move = snapshot && firstOpen ? ((snapshot.data.price - firstOpen) / firstOpen) * 100 : null;
  return (
    <TableRow>
      <TableCell>
        <Link href={`/dashboard/markets/${encodeURIComponent(symbol)}`} className="font-medium hover:underline">
          {symbol}
        </Link>
      </TableCell>
      <TableCell className="font-medium tabular-nums">
        {snapshot ? formatPrice(snapshot.data.price) : missingValue(loading)}
      </TableCell>
      <TableCell className="tabular-nums">{move === null ? "—" : <Change value={move} />}</TableCell>
      <TableCell>
        {snapshot?.data.trend ? <Badge variant="outline">{formatTrend(snapshot.data.trend)}</Badge> : "—"}
      </TableCell>
    </TableRow>
  );
}

export function PulseCard({
  symbol,
  snapshot,
  loading,
}: {
  symbol: string;
  snapshot?: Snapshot | null;
  loading: boolean;
}) {
  const firstOpen = snapshot?.data.candles[0]?.open;
  const move = snapshot && firstOpen ? ((snapshot.data.price - firstOpen) / firstOpen) * 100 : null;
  let trendLabel = loading ? "Loading quote…" : "Quote unavailable";
  if (snapshot) trendLabel = snapshot.data.trend ? formatTrend(snapshot.data.trend) : "Trend unavailable";
  return (
    <Link
      href={`/dashboard/markets/${encodeURIComponent(symbol)}`}
      className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="py-0 shadow-none transition-colors group-hover:bg-muted/30">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <AssetMark symbol={symbol} small />
                <p className="font-medium text-sm">{marketName(symbol)}</p>
              </div>
              <p className="mt-1 text-muted-foreground text-xs">{trendLabel}</p>
            </div>
            {snapshot ? (
              <Badge variant={snapshot.freshness === "fresh" ? "secondary" : "outline"}>
                {snapshot.freshness === "fresh" ? "Recent" : "Cached"}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-lg tabular-nums">{snapshot ? formatPrice(snapshot.data.price) : "—"}</p>
              <p className="mt-1 text-muted-foreground text-xs">
                {move === null ? (
                  "Window move —"
                ) : (
                  <>
                    Window move <Change value={move} />
                  </>
                )}
              </p>
            </div>
            {snapshot ? (
              <MarketSparkline
                className="h-10 w-24"
                values={snapshot.data.candles.slice(-48).map((candle) => candle.close)}
                positive={(move ?? 0) >= 0}
              />
            ) : null}
          </div>
          <p className="truncate border-t pt-2 text-[11px] text-muted-foreground">
            Provider observation {snapshot ? new Date(snapshot.data.timestamp).toLocaleTimeString() : "not available"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
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
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}

function formatTrend(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}

function missingValue(loading: boolean) {
  return loading ? "…" : "Unavailable";
}
