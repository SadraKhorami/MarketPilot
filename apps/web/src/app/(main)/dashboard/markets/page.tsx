import Link from "next/link";

import { ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoAssets, formatPrice } from "@/data/marketpilot";

import { ChangeText, FixtureNote, MarketPilotPage, StatusBadge } from "../_components/marketpilot-page";
import { PriceHistoryChart } from "../_components/price-history-chart";

export const metadata: Metadata = { title: "Markets · MarketPilot" };

export default function MarketsPage() {
  const btc = demoAssets[0];
  return (
    <MarketPilotPage
      title="Markets"
      description="Explore illustrative prices, trend context, and technical signals across the demo asset universe."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Assets tracked", "06", "Sample coverage"],
          ["Advancing", "03", "Illustrative daily moves"],
          ["Market mode", "Mixed", "Sample trend read"],
        ].map(([label, value, detail]) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="mt-2 font-semibold text-2xl">{value}</p>
              <p className="mt-1 text-muted-foreground text-xs">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Asset universe</CardTitle>
            <CardDescription>Fixture symbols · not a confirmed MarketFeed coverage list</CardDescription>
          </div>
          <Badge variant="outline">
            <ChartNoAxesCombined /> Sample universe
          </Badge>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>24h</TableHead>
                  <TableHead>Market cap</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>
                    <span className="sr-only">Details</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoAssets.map((asset) => (
                  <TableRow key={asset.symbol}>
                    <TableCell>
                      <Link href={`/dashboard/markets/${asset.symbol}`} className="font-medium hover:underline">
                        {asset.name}
                        <span className="ml-2 text-muted-foreground">{asset.symbol}</span>
                      </Link>
                      <span className="block text-muted-foreground text-xs">{asset.category}</span>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">{formatPrice(asset.price)}</TableCell>
                    <TableCell>
                      <ChangeText value={asset.change24h} />
                    </TableCell>
                    <TableCell>{asset.marketCap}</TableCell>
                    <TableCell>
                      <StatusBadge value={asset.trend} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={asset.sentiment} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild aria-label={`View ${asset.name} details`}>
                        <Link href={`/dashboard/markets/${asset.symbol}`}>
                          <ArrowUpRight />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {btc ? (
        <Card className="shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Price history</CardTitle>
              <CardDescription>{btc.name} · sample intraday series</CardDescription>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">{formatPrice(btc.price)}</p>
              <ChangeText value={btc.change24h} />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <PriceHistoryChart data={btc.history} />
            <div className="flex items-center justify-between border-t pt-3">
              <FixtureNote />
              <Button variant="link" size="sm" asChild>
                <Link href="/dashboard/markets/BTC">
                  Open BTC detail <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </MarketPilotPage>
  );
}
