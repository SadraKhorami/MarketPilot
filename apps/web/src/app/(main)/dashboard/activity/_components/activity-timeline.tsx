"use client";
import { useEffect, useState } from "react";

import { Activity, BellRing, Bookmark, KeyRound, LogIn, Settings2, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";

import { CollectionSearch, FilterSelect, rangeOptions } from "../../_components/collection-filters";
import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";

interface ActivityEvent {
  id: string;
  description: string;
  eventType: string;
  occurredAt: string;
}
function category(event: string) {
  if (event.startsWith("API_KEY")) return { label: "API key", icon: KeyRound };
  if (event.startsWith("WATCHLIST")) return { label: "Watchlist", icon: Bookmark };
  if (event.startsWith("ALERT")) return { label: "Alert", icon: BellRing };
  if (event.includes("SIGNED") || event.includes("SESSION")) return { label: "Security", icon: LogIn };
  if (event.includes("PREFERENCES")) return { label: "Settings", icon: Settings2 };
  return { label: "Account", icon: UserRound };
}
export function ActivityTimeline() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const resource = useApiResource<PagedResult<ActivityEvent>>(
    `/activity/history?${new URLSearchParams({ search: query, days, page: String(page), pageSize: String(pageSize) })}`,
  );
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of resource.data?.items ?? []) {
    const day = new Date(event.occurredAt).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your account history</CardTitle>
        <CardDescription>Security events, saved resources and preference changes in one timeline.</CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <CollectionSearch value={search} onChange={setSearch} placeholder="Search your activity" />
          <FilterSelect
            label="Activity period"
            value={days}
            options={rangeOptions}
            onChange={(value) => {
              setDays(value);
              setPage(1);
            }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ResourceState {...resource} retry={resource.reload} />
        {!resource.loading &&
          !resource.error &&
          (groups.size ? (
            <div className="flex flex-col gap-6">
              {Array.from(groups, ([day, events]) => (
                <section key={day} className="flex flex-col gap-3">
                  <h2 className="font-medium text-muted-foreground text-sm">{day}</h2>
                  <ol className="flex flex-col">
                    {events.map((event) => {
                      const { label, icon: Icon } = category(event.eventType);
                      return (
                        <li key={event.id} className="group relative flex gap-3 pb-5 last:pb-0">
                          <span
                            aria-hidden="true"
                            className="absolute top-8 bottom-0 left-4 border-l group-last:hidden"
                          />
                          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                            <Icon className="size-4 text-muted-foreground" />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              <p className="font-medium text-sm">{event.description}</p>
                              <time dateTime={event.occurredAt} className="text-muted-foreground text-xs">
                                {new Date(event.occurredAt).toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>
                            </div>
                            <Badge variant="outline">{label}</Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Activity />
                </EmptyMedia>
                <EmptyTitle>No activity in this view</EmptyTitle>
                <EmptyDescription>Try a broader search or a different date range.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ))}
      </CardContent>
      <CollectionPagination
        page={page}
        pageSize={pageSize}
        total={resource.data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </Card>
  );
}
