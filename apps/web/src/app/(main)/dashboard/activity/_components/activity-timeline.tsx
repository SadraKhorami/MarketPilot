"use client";

import { useEffect, useState } from "react";

import { Activity, BellRing, KeyRound, ListChecks, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

type Event = { id: string; eventType: string; description: string; occurredAt: string };
const iconFor = (eventType: string) =>
  eventType.startsWith("ALERT")
    ? BellRing
    : eventType.startsWith("API_KEY")
      ? KeyRound
      : eventType.startsWith("WATCHLIST")
        ? ListChecks
        : UserRound;

export function ActivityTimeline() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiRequest<ApiEnvelope<Event[]>>("/activity?limit=50")
      .then(({ data }) => setEvents(data))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load activity."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Events are stored with your account and scoped to your user.</CardDescription>
        </div>
        <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent className="space-y-0">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground" role="status">
            Loading activity…
          </p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">No activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Account events will appear here as you use MarketPilot.
            </p>
          </div>
        ) : (
          events.map((event, index) => {
            const Icon = iconFor(event.eventType);
            return (
              <div key={event.id} className="relative flex gap-4 pb-7 last:pb-0">
                <div className="relative flex flex-col items-center">
                  <span className="z-10 flex size-9 items-center justify-center rounded-full border bg-background">
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  {index < events.length - 1 ? <span className="absolute top-9 bottom-0 w-px bg-border" /> : null}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium text-sm">
                      {event.description}
                      <Badge variant="secondary" className="ml-2">
                        {event.eventType.toLowerCase().replaceAll("_", " ")}
                      </Badge>
                    </p>
                    <time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>
                      {new Date(event.occurredAt).toLocaleString()}
                    </time>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
