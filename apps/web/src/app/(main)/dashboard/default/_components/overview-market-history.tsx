import type { ReactNode } from "react";

import { CandlestickChart } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { MarketHistoryPanel } from "../../_components/market-history-panel";
import type { Snapshot } from "./overview-cards";
import { type HistoryRange, historyRanges } from "./overview-preferences";
export function OverviewMarketHistory({
  symbol,
  range,
  snapshot,
  loading,
  settings,
}: {
  symbol: string;
  range: HistoryRange;
  snapshot?: Snapshot | null;
  loading: boolean;
  settings: ReactNode;
}) {
  const window = historyRanges[range];
  const candles =
    snapshot?.data.candles.filter((candle) => Date.parse(candle.time) >= Date.now() - window.milliseconds) ?? [];
  if (snapshot && candles.length)
    return (
      <MarketHistoryPanel
        compact
        data={{ ...snapshot.data, candles }}
        stale={snapshot.freshness === "stale"}
        toolbar={
          <p className="text-muted-foreground text-xs">
            {window.label} · Showing available completed candles within this range.
          </p>
        }
        settings={settings}
        className="h-full"
      />
    );
  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle>Market history</CardTitle>
        <CardDescription>
          {symbol} · {window.label}
        </CardDescription>
        <CardAction>{settings}</CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CandlestickChart />
              </EmptyMedia>
              <EmptyTitle>No history available in this range</EmptyTitle>
              <EmptyDescription>
                Try another market or range in settings. Data refreshes automatically.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
