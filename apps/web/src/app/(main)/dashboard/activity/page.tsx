import { Activity, BellRing, Bot, KeyRound, ListChecks } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoActivity } from "@/data/marketpilot";

import { FixtureNote, MarketPilotPage } from "../_components/marketpilot-page";

export const metadata: Metadata = { title: "Activity · MarketPilot" };

const icons = { watchlist: ListChecks, alert: BellRing, bot: Bot, api: KeyRound } as const;

export default function ActivityPage() {
  return (
    <MarketPilotPage
      title="Activity"
      description="Review changes and account events recorded in the workspace."
      actions={
        <Button variant="outline" disabled>
          <Activity /> Audit service disconnected
        </Button>
      }
    >
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Fictional preview entries · no real account actions</CardDescription>
          </div>
          <Badge variant="outline">Sample timeline</Badge>
        </CardHeader>
        <CardContent className="space-y-0">
          {demoActivity.map((event, index) => {
            const Icon = icons[event.icon];
            return (
              <div key={event.id} className="relative flex gap-4 pb-7 last:pb-0">
                <div className="relative flex flex-col items-center">
                  <span className="z-10 flex size-9 items-center justify-center rounded-full border bg-background">
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  {index < demoActivity.length - 1 ? <span className="absolute top-9 bottom-0 w-px bg-border" /> : null}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium text-sm">
                      {event.title}
                      <Badge variant="secondary" className="ml-2">
                        Demo
                      </Badge>
                    </p>
                    <time className="text-muted-foreground text-xs">{event.time}</time>
                  </div>
                  <p className="mt-1 text-muted-foreground text-sm">{event.detail}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
          <FixtureNote>Audit history is not connected or persisted.</FixtureNote>
        </div>
      </Card>
    </MarketPilotPage>
  );
}
