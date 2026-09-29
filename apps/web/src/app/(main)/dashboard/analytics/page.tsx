import { Activity, ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, CircleHelp } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoAssets, formatPrice } from "@/data/marketpilot";

import { ChangeText, FixtureNote, MarketPilotPage, StatusBadge } from "../_components/marketpilot-page";
import { PriceHistoryChart } from "../_components/price-history-chart";

export const metadata: Metadata = { title: "Analytics · MarketPilot" };

const trendStyles = {
  Bullish: "bg-emerald-500",
  Sideways: "bg-amber-400",
  Bearish: "bg-rose-500",
} as const;

export default function AnalyticsPage() {
  const btc = demoAssets[0];
  return (
    <MarketPilotPage
      title="Analytics"
      description="Compare sample market moves and signals across the tracked asset set."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Universe coverage", "6 assets", "Illustrative fixture set"],
          ["Median 24h move", "+0.61%", "Sample observations"],
          ["Trend breadth", "3 / 6", "Bullish classifications"],
          ["Sentiment split", "42 / 38 / 20", "Positive · mixed · negative"],
        ].map(([label, value, description]) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="mt-2 font-semibold text-xl tabular-nums">{value}</p>
              <p className="mt-1 text-muted-foreground text-xs">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Price comparison</CardTitle>
              <CardDescription>BTC illustrative series · common units vary by asset</CardDescription>
            </div>
            <ChartNoAxesCombined className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="pt-0">
            {btc ? <PriceHistoryChart data={btc.history} /> : null}
            <FixtureNote />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Signal distribution</CardTitle>
            <CardDescription>Sample classifications · not a forecast</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["Bullish", "Sideways", "Bearish"] as const).map((trend) => {
              const count = demoAssets.filter((asset) => asset.trend === trend).length;
              return (
                <div key={trend} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{trend}</span>
                    <span className="text-muted-foreground tabular-nums">{count} assets</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${trendStyles[trend]}`}
                      style={{ width: `${(count / demoAssets.length) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
              <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Signal counts are computed from local UI fixtures. No analytics service or real-time data source is
              connected.
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Relative performance</CardTitle>
          <CardDescription>Illustrative 24-hour changes and directional context</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>24h change</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Sample context</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoAssets.map((asset) => (
                  <TableRow key={asset.symbol}>
                    <TableCell className="font-medium">
                      {asset.name}
                      <span className="ml-2 text-muted-foreground">{asset.symbol}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatPrice(asset.price)}</TableCell>
                    <TableCell>
                      <ChangeText value={asset.change24h} />
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {asset.change24h >= 0 ? (
                          <ArrowUpRight className="size-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="size-4 text-rose-500" />
                        )}
                        <StatusBadge value={asset.trend} />
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={asset.sentiment} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {asset.indicators[0]?.name} {asset.indicators[0]?.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Coverage and freshness</CardTitle>
            <CardDescription>Frontend fixture metadata</CardDescription>
          </div>
          <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-sm">Source</p>
            <p className="mt-1 font-medium">Local typed fixtures</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Last refresh</p>
            <p className="mt-1 font-medium">Not applicable</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Live connection</p>
            <p className="mt-1 font-medium">Not connected</p>
          </div>
        </CardContent>
      </Card>
    </MarketPilotPage>
  );
}
