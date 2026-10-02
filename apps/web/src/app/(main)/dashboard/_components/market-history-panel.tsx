"use client";

import { type ReactNode, useId, useMemo, useState } from "react";

import { referenceMarkets, marketSourceLabel, type MarketObservation } from "@marketpilot/market-data";
import { cn } from "cn";
import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const config = {
  close: { label: "Close", color: "var(--color-emerald-500)" },
  average: { label: "50-period average", color: "var(--color-violet-500)" },
  volume: { label: "Volume", color: "var(--color-sky-500)" },
} satisfies ChartConfig;

export function MarketHistoryPanel({
  data,
  stale = false,
  toolbar,
  className,
  settings,
}: {
  data: MarketObservation;
  stale?: boolean;
  toolbar?: ReactNode;
  className?: string;
  settings?: ReactNode;
}) {
  const [view, setView] = useState("price");
  const fillId = useId().replace(/:/g, "");
  const points = useMemo(
    () =>
      data.candles.map((candle, index, candles) => ({
        ...candle,
        timestamp: Date.parse(candle.time),
        average:
          index >= 49 ? candles.slice(index - 49, index + 1).reduce((total, item) => total + item.close, 0) / 50 : null,
      })),
    [data.candles],
  );
  const formatTime = (time: number) =>
    new Date(time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const quote = data.symbol.split("-").at(-1) ?? "USD";
  const formatPrice = (value: number) =>
    `${new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 1 ? 6 : 2 }).format(value)} ${quote}`;
  const first = data.candles[0];
  const last = data.candles.at(-1);
  const hasVolume = data.candles.every((candle) => candle.volume !== null);
  const volume = hasVolume ? data.candles.reduce((total, candle) => total + (candle.volume ?? 0), 0) : null;
  const chartView = hasVolume ? view : "price";
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>Market history</CardTitle>
        <CardDescription>
          {data.symbol} · {data.interval} candles ·{" "}
          {stale ? "Cached observation" : marketSourceLabel(data.source ?? "coinbase-exchange")}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={chartView}
            onValueChange={(value) => {
              if (value) setView(value);
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Chart view"
          >
            <ToggleGroupItem value="price">Price</ToggleGroupItem>
            <ToggleGroupItem value="volume" disabled={!hasVolume}>
              Volume
            </ToggleGroupItem>
          </ToggleGroup>
          {settings}
        </CardAction>
        {toolbar ? <div className="col-span-full pt-3">{toolbar}</div> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground text-xs">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            Candle close
          </span>
          {chartView === "price" ? (
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-3 bg-violet-500" />
              50-period average
            </span>
          ) : (
            <Badge variant="outline">Volume in {data.symbol.split("-")[0]}</Badge>
          )}
        </div>
        <ChartContainer config={config} className={cn("aspect-auto h-64 w-full sm:h-72", toolbar && "grow")}>
          <ComposedChart accessibilityLayer data={points} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-close)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-close)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickCount={5}
              tickFormatter={(value: number) =>
                new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit" })
              }
              axisLine={false}
              tickLine={false}
              minTickGap={36}
              tickMargin={10}
            />
            <YAxis
              width={64}
              axisLine={false}
              tickLine={false}
              domain={chartView === "price" ? ["auto", "auto"] : [0, "auto"]}
              tickFormatter={(value: number) =>
                new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value)
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatTime(Number(value))}
                  formatter={(value, name) => (
                    <span className="flex w-full justify-between gap-6">
                      <span className="text-muted-foreground">
                        {{ close: "Close", average: "SMA 50", volume: "Volume" }[String(name)] ?? String(name)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {chartView === "price"
                          ? formatPrice(Number(value))
                          : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </span>
                  )}
                />
              }
            />
            {chartView === "price" ? (
              <>
                <Area
                  dataKey="close"
                  type="linear"
                  stroke="var(--color-close)"
                  strokeWidth={2}
                  fill={`url(#${fillId})`}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="average"
                  type="linear"
                  stroke="var(--color-average)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </>
            ) : (
              <Bar dataKey="volume" fill="var(--color-volume)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ChartContainer>
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
          {points.length} candles
        </p>
      </CardContent>
    </Card>
  );
}
