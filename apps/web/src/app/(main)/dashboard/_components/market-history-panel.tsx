"use client";

import type { ReactNode } from "react";

import type { JournalRecord } from "@marketpilot/ai/contracts";
import { type MarketObservation, marketSourceLabel, referenceMarkets } from "@marketpilot/market-data";
import { cn } from "cn";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { AlertRecord } from "../alerts/_components/alert-types";
import { InteractiveMarketChart } from "./interactive-market-chart";
import { pricePrecision } from "./market-chart-utils";

export function MarketHistoryPanel({
  data,
  stale = false,
  toolbar,
  className,
  settings,
  alerts = [],
  onAlertSelect,
  alertStatus,
  status,
  compact = false,
  journal = [],
  onJournalSelect,
  journalPreview = false,
}: {
  data: MarketObservation;
  stale?: boolean;
  toolbar?: ReactNode;
  className?: string;
  settings?: ReactNode;
  alerts?: AlertRecord[];
  onAlertSelect?: (id: string) => void;
  alertStatus?: ReactNode;
  status?: ReactNode;
  compact?: boolean;
  journal?: JournalRecord[];
  onJournalSelect?: (id: string) => void;
  journalPreview?: boolean;
}) {
  const formatTime = (time: number) =>
    new Date(time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const quote = data.symbol.split("-").at(-1) ?? "USD";
  const formatPrice = (value: number) =>
    `${new Intl.NumberFormat(undefined, { maximumFractionDigits: pricePrecision(value) }).format(value)} ${quote}`;
  const first = data.candles[0];
  const last = data.candles.at(-1);
  const hasVolume = data.candles.every((candle) => candle.volume !== null);
  const volume = hasVolume ? data.candles.reduce((total, candle) => total + (candle.volume ?? 0), 0) : null;

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>Market history</CardTitle>
        <CardDescription>
          {data.symbol} · {data.interval} candles ·{" "}
          {stale ? "Cached observation" : marketSourceLabel(data.source ?? "coinbase-exchange")}
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          {status}
          {settings}
        </CardAction>
        {toolbar ? <div className="col-span-full pt-3">{toolbar}</div> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <InteractiveMarketChart
          key={`${data.symbol}:${data.interval}`}
          data={data}
          compact={compact}
          alerts={alerts}
          journal={journal}
          journalPreview={journalPreview}
          onJournalSelect={onJournalSelect}
          onAlertSelect={onAlertSelect}
        />
        {alertStatus}
        <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
          {[
            { label: "Window open", value: first ? formatPrice(first.open) : "—" },
            { label: "Window high", value: formatPrice(Math.max(...data.candles.map((candle) => candle.high))) },
            { label: "Window low", value: formatPrice(Math.min(...data.candles.map((candle) => candle.low))) },
            {
              label: "Traded volume",
              value:
                volume === null
                  ? "Not supplied by this source"
                  : `${volume.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 })} ${referenceMarkets.find((market) => market.symbol === data.symbol)?.assetClass === "stock" ? "shares" : data.symbol.split("-")[0]}`,
            },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">{item.label}</span>
              <span className="font-medium text-sm tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {first ? formatTime(Date.parse(first.time)) : "—"} – {last ? formatTime(Date.parse(last.time)) : "—"} ·{" "}
          {data.candles.length} candles
        </p>
      </CardContent>
    </Card>
  );
}
