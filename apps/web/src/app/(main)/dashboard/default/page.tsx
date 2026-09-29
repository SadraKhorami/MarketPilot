import Link from "next/link";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Bot,
  CircleCheck,
  CircleDollarSign,
  Newspaper,
  Radar,
  Sparkles,
  WalletCards,
} from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  defaultWatchlist,
  demoActivity,
  demoAlerts,
  demoAssets,
  demoNews,
  findAsset,
  formatPrice,
} from "@/data/marketpilot";

import { ChangeText, FixtureNote, MarketPilotPage, StatusBadge } from "../_components/marketpilot-page";
import { PriceHistoryChart } from "../_components/price-history-chart";

export const metadata: Metadata = {
  title: "Dashboard · MarketPilot",
  description: "Market intelligence overview in the MarketPilot workspace preview.",
};

const overviewStats = [
  { label: "Tracked assets", value: "04", detail: "Across 1 watchlist", icon: Radar },
  { label: "Positive trends", value: "02", detail: "Of 6 demo assets", icon: ArrowUpRight },
  { label: "Active alerts", value: "02", detail: "One paused", icon: BellRing },
  { label: "Overall sentiment", value: "Mixed", detail: "Illustrative provider view", icon: Activity },
];

export default function DashboardPage() {
  const btc = findAsset("BTC");

  return (
    <MarketPilotPage
      title="Market overview"
      description="A focused view of the assets, trends, and signals in your workspace."
      actions={
        <Button asChild>
          <Link href="/dashboard/markets">
            <CircleDollarSign /> Explore markets
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="shadow-none">
            <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
              <div>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-2 font-semibold text-2xl tracking-tight">{value}</p>
                <p className="mt-1 text-muted-foreground text-xs">{detail}</p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.9fr)]">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">Market trend</CardTitle>
              <CardDescription>Bitcoin · illustrative 24-hour price history</CardDescription>
            </div>
            {btc ? (
              <div className="text-right">
                <p className="font-semibold text-lg">{formatPrice(btc.price)}</p>
                <ChangeText value={btc.change24h} />
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="pt-0">
            {btc ? <PriceHistoryChart data={btc.history} /> : null}
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <FixtureNote />
              <Button variant="link" size="sm" asChild>
                <Link href="/dashboard/markets/BTC">
                  Asset details <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Watchlist snapshot</CardTitle>
            <CardDescription>Main watchlist · {defaultWatchlist.length} assets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {defaultWatchlist.slice(0, 4).map((symbol) => {
              const asset = findAsset(symbol);
              if (!asset) return null;
              return (
                <Link
                  key={asset.symbol}
                  href={`/dashboard/markets/${asset.symbol}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>
                    <span className="block font-medium text-sm">{asset.symbol}</span>
                    <span className="text-muted-foreground text-xs">{asset.name}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium text-sm tabular-nums">{formatPrice(asset.price)}</span>
                    <ChangeText value={asset.change24h} />
                  </span>
                </Link>
              );
            })}
            <Button variant="outline" className="mt-2 w-full" asChild>
              <Link href="/dashboard/watchlist">
                Open watchlist <ArrowUpRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Sentiment</CardTitle>
              <CardDescription>Sample distribution · 6 assets</CardDescription>
            </div>
            <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-semibold text-2xl">Mixed</p>
                <FixtureNote>Illustrative read</FixtureNote>
              </div>
              <StatusBadge value="Mixed" />
            </div>
            <div
              className="flex h-2 overflow-hidden rounded-full bg-muted"
              aria-label="Illustrative sentiment distribution"
              role="img"
            >
              <span className="w-[42%] bg-emerald-500" />
              <span className="w-[38%] bg-amber-400" />
              <span className="w-[20%] bg-rose-500" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <span className="text-emerald-700 dark:text-emerald-400">
                Positive <strong className="block text-foreground">42%</strong>
              </span>
              <span className="text-amber-700 dark:text-amber-400">
                Mixed <strong className="block text-foreground">38%</strong>
              </span>
              <span className="text-rose-700 dark:text-rose-400">
                Negative <strong className="block text-foreground">20%</strong>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Latest news</CardTitle>
              <CardDescription>Sample headlines · no news provider connected</CardDescription>
            </div>
            <Newspaper className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="divide-y">
            {demoNews.slice(0, 3).map((item) => (
              <Link
                key={item.id}
                href="/dashboard/news-and-sentiment"
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-sm leading-5">{item.headline}</span>
                  <span className="text-muted-foreground text-xs">
                    {item.category} · {item.publishedAt}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">{item.asset}</Badge>
                  <StatusBadge value={item.sentiment} />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-none lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">AI market summary</CardTitle>
              <CardDescription>Illustrative copy · not AI-generated</CardDescription>
            </div>
            <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm leading-6">
              Major assets show mixed short-term momentum in this sample workspace. This card is a UI preview; no market
              tools or AI provider are connected.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard/ai-analyst">
                <Bot /> Open AI Analyst
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent alerts</CardTitle>
              <CardDescription>Example rules · not evaluated</CardDescription>
            </div>
            <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-3">
            {demoAlerts.slice(0, 2).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">
                    {alert.asset} {alert.condition.toLowerCase()} {alert.threshold}
                  </p>
                  <p className="text-muted-foreground text-xs">{alert.updatedAt}</p>
                </div>
                <StatusBadge value={alert.status} />
              </div>
            ))}
            <Button variant="link" className="px-0" asChild>
              <Link href="/dashboard/alerts">View all alerts</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">System status</CardTitle>
              <CardDescription>Local UI preview environment</CardDescription>
            </div>
            <CircleCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Dashboard", "Ready", CircleCheck],
              ["Market data", "Not connected", ArrowDownRight],
              ["AI tools", "Not connected", Bot],
            ].map(([label, state, icon]) => {
              const Icon = icon;
              return (
                <div key={label as string} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                    {label as string}
                  </span>
                  <span className="font-medium">{state as string}</span>
                </div>
              );
            })}
            <FixtureNote>Readiness refers to this interface only.</FixtureNote>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Watchlist market overview</CardTitle>
            <CardDescription>Sample prices · not live data</CardDescription>
          </div>
          <WalletCards className="size-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>24h change</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Sentiment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoAssets
                  .filter((asset) => defaultWatchlist.includes(asset.symbol))
                  .map((asset) => (
                    <TableRow key={asset.symbol}>
                      <TableCell>
                        <Link className="font-medium hover:underline" href={`/dashboard/markets/${asset.symbol}`}>
                          {asset.name} <span className="text-muted-foreground">{asset.symbol}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatPrice(asset.price)}</TableCell>
                      <TableCell>
                        <ChangeText value={asset.change24h} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={asset.trend} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={asset.sentiment} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Recent workspace activity</CardTitle>
          <CardDescription>Sample local activity</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {demoActivity.slice(0, 2).map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
              <span className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-muted">
                <Activity className="size-4" aria-hidden="true" />
              </span>
              <span>
                <strong className="block font-medium text-sm">{item.title}</strong>
                <span className="text-muted-foreground text-xs">
                  {item.detail} · {item.time}
                </span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </MarketPilotPage>
  );
}
