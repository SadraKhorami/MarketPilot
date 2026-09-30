import { CandlestickChart } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { MarketHistoryPanel } from "../../_components/market-history-panel";
import type { Snapshot } from "./overview-cards";

export function OverviewMarketHistory({
  symbol,
  symbols,
  onSymbolChange,
  snapshot,
  loading,
}: {
  symbol: string;
  symbols: string[];
  onSymbolChange: (symbol: string) => void;
  snapshot?: Snapshot | null;
  loading: boolean;
}) {
  const selector = (
    <ToggleGroup
      type="single"
      value={symbol}
      onValueChange={(value) => {
        if (value) onSymbolChange(value);
      }}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Market history asset"
    >
      {symbols.map((value) => (
        <ToggleGroupItem key={value} value={value}>
          {value.split("-")[0]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  if (snapshot)
    return (
      <MarketHistoryPanel
        data={snapshot.data}
        stale={snapshot.freshness === "stale"}
        toolbar={selector}
        className="h-full"
      />
    );

  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle>Market history</CardTitle>
        <div className="pt-3">{selector}</div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <Skeleton className="h-80 w-full flex-1" />
        ) : (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CandlestickChart />
              </EmptyMedia>
              <EmptyTitle>Price history is temporarily unavailable</EmptyTitle>
              <EmptyDescription>We’ll retry automatically. You can also explore another market above.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
