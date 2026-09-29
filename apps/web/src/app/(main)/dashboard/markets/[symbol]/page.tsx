import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, ArrowUpRight, BookmarkPlus } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { findAsset, formatPrice } from "@/data/marketpilot";

import { ChangeText, FixtureNote, MarketPilotPage, StatusBadge } from "../../_components/marketpilot-page";
import { PriceHistoryChart } from "../../_components/price-history-chart";

type AssetPageProps = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: AssetPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const asset = findAsset(symbol);
  return { title: asset ? `${asset.name} (${asset.symbol}) · MarketPilot` : "Asset not found · MarketPilot" };
}

export default async function AssetDetailsPage({ params }: AssetPageProps) {
  const { symbol } = await params;
  const asset = findAsset(symbol);
  if (!asset) notFound();

  return (
    <MarketPilotPage
      title={`${asset.name} (${asset.symbol})`}
      description={`${asset.category} · Illustrative asset detail and technical context.`}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href="/dashboard/watchlist">
              <BookmarkPlus /> Watchlist
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/markets">
              <ArrowLeft /> Markets
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Sample price", formatPrice(asset.price)],
          ["Illustrative 24h change", <ChangeText key="change" value={asset.change24h} />],
          ["Market cap", asset.marketCap],
          ["Volume · 24h", asset.volume24h],
        ].map(([label, value]) => (
          <Card key={label as string} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="mt-2 font-semibold text-xl">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Price history</CardTitle>
              <CardDescription>Sample points · period controls are not connected</CardDescription>
            </div>
            <Badge variant="outline">Demo series</Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <PriceHistoryChart data={asset.history} />
            <FixtureNote />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Trend context</CardTitle>
            <CardDescription>Illustrative classification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Direction</span>
              <StatusBadge value={asset.trend} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Sentiment</span>
              <StatusBadge value={asset.sentiment} />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium text-sm">Trend note</p>
              <p className="mt-1 text-muted-foreground text-sm">
                This sample view illustrates how provider-backed trend context may be presented. No market analysis
                provider is connected.
              </p>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard/ai-analyst">
                Ask AI Analyst <ArrowUpRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Technical indicators</CardTitle>
          <CardDescription>
            Example values for layout preview; indicator methodology and time windows are not connected to a provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator</TableHead>
                  <TableHead>Sample value</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Context</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.indicators.map((indicator) => (
                  <TableRow key={indicator.name}>
                    <TableCell className="font-medium">{indicator.name}</TableCell>
                    <TableCell className="tabular-nums">{indicator.value}</TableCell>
                    <TableCell>
                      <StatusBadge value={indicator.signal} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">Illustrative fixture</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </MarketPilotPage>
  );
}
