import { ChartColumn, CircleHelp } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { UsageChart } from "../_components/usage-chart";

export const metadata: Metadata = { title: "API Usage · MarketPilot" };

export default function ApiUsagePage() {
  return (
    <MarketPilotPage
      title="API usage"
      description="Inspect the usage dashboard layout. These values are sample fixtures, not account activity."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Requests · 7 days", "10,320"],
          ["Success rate", "99.2%"],
          ["Median latency", "142 ms"],
          ["Rate limit", "Not configured"],
        ].map(([label, value]) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="mt-2 font-semibold text-xl tabular-nums">{value}</p>
              <p className="mt-1 text-muted-foreground text-xs">Example only · no real requests</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Request volume</CardTitle>
              <CardDescription>Illustrative seven-day distribution</CardDescription>
            </div>
            <ChartColumn className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <UsageChart />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Usage by scope</CardTitle>
            <CardDescription>Preview breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["Market reads", 58],
              ["News and sentiment", 27],
              ["Other", 15],
            ].map(([label, percentage]) => (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            ))}
            <div className="flex gap-2 rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
              <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Usage records require an authenticated API service and will not be written by this preview.
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketPilotPage>
  );
}
