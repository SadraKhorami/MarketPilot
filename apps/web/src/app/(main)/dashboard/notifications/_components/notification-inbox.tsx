"use client";
import { useEffect, useState } from "react";

import Link from "next/link";

import { Bell, CheckCheck, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";

import { CollectionSearch, FilterSelect } from "../../_components/collection-filters";
import { CollectionPagination } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import { NotificationDetail } from "./notification-detail";
import { useNotifications } from "./notification-provider";
import { NotificationRow } from "./notification-row";
import type { NotificationRecord } from "./notification-types";
import { useNotificationFeed } from "./use-notification-feed";
export function NotificationInbox() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [selected, setSelected] = useState<NotificationRecord | null>(null);
  const { summary, error: summaryError, refresh, pending, mutate } = useNotifications();
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuerySearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status });
  if (category !== "all") query.set("category", category);
  if (querySearch) query.set("search", querySearch);
  const feed = useNotificationFeed(query.toString());
  useEffect(() => {
    if (feed.data && !feed.loading && page > Math.max(1, feed.data.totalPages))
      setPage(Math.max(1, feed.data.totalPages));
  }, [feed.data, feed.loading, page]);
  const select = (item: NotificationRecord) => {
    setSelected(item);
    if (!item.readAt) void mutate(`/notifications/${item.id}`, { read: true });
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {summary && (
            <>
              <Badge variant="secondary">{summary.unread} unread</Badge>
              <Badge variant="outline">{summary.inbox} in inbox</Badge>
              <Badge variant="outline">{summary.archived} archived</Badge>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!summary?.unread || pending || !!summaryError}
            onClick={() => void mutate("/notifications/read-all", undefined, "POST")}
          >
            <CheckCheck data-icon="inline-start" />
            Mark inbox as read
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/settings/notifications">
              <Settings2 data-icon="inline-start" />
              Preferences
            </Link>
          </Button>
        </div>
      </div>
      {summaryError && <ResourceState loading={false} error={summaryError} retry={() => void refresh()} />}
      <Card>
        <CardHeader>
          <CardTitle>Your notifications</CardTitle>
          <CardDescription>Security and account notices, plus announcements from the MarketPilot team.</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <CollectionSearch placeholder="Search notifications" value={search} onChange={setSearch} />
            <FilterSelect
              label="Notification status"
              value={status}
              options={[
                ["all", "Inbox"],
                ["unread", "Unread"],
                ["read", "Read"],
                ["archived", "Archived"],
              ]}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            <FilterSelect
              label="Notification category"
              value={category}
              options={[
                ["all", "All categories"],
                ["SECURITY", "Security"],
                ["ACCOUNT", "Account"],
                ["ANNOUNCEMENT", "Announcements"],
                ["MARKET_ALERT", "Market alerts"],
              ]}
              onChange={(value) => {
                setCategory(value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <ResourceState {...feed} retry={feed.reload} />
          {!feed.loading &&
            !feed.error &&
            (feed.data?.items.length ? (
              <ItemGroup>
                {feed.data.items.map((item) => (
                  <NotificationRow key={item.id} item={item} onSelect={select} />
                ))}
              </ItemGroup>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Bell />
                  </EmptyMedia>
                  <EmptyTitle>No notifications here</EmptyTitle>
                  <EmptyDescription>
                    {search || category !== "all"
                      ? "Try another search or category."
                      : "New messages will appear automatically. Archived messages can be restored to your inbox."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ))}
        </CardContent>
        <CollectionPagination
          page={page}
          pageSize={pageSize}
          total={feed.data?.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Card>
      <NotificationDetail item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
