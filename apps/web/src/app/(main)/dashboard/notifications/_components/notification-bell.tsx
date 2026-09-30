"use client";
import { useState } from "react";

import Link from "next/link";

import { Bell, CheckCheck, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { ResourceState } from "../../_components/resource-state";
import { NotificationDetail } from "./notification-detail";
import { useNotifications } from "./notification-provider";
import { NotificationRow } from "./notification-row";
import type { NotificationRecord } from "./notification-types";
import { useNotificationFeed } from "./use-notification-feed";
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<NotificationRecord | null>(null);
  const { summary, error, loading, refresh, pending, mutate } = useNotifications();
  const feed = useNotificationFeed("pageSize=8", open);
  const unread = summary?.unread ?? 0;
  let triggerLabel = `Notifications, ${unread} unread`;
  if (loading) triggerLabel = "Loading notifications";
  else if (error) triggerLabel = "Notifications unavailable";
  const select = (item: NotificationRecord) => {
    setOpen(false);
    setSelected(item);
    if (!item.readAt) void mutate(`/notifications/${item.id}`, { read: true });
  };
  return (
    <>
      <Popover
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (value) void refresh();
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={triggerLabel} aria-busy={loading}>
            <Bell />
            {unread > 0 && !error && (
              <Badge className="absolute -top-1 -right-1 min-w-4 justify-center px-1 text-[10px]" aria-hidden="true">
                {unread > 99 ? "99+" : unread}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] gap-3 p-4" aria-label="Notifications">
          <PopoverHeader>
            <div className="flex items-center justify-between gap-2">
              <PopoverTitle>Notifications</PopoverTitle>
              <Button variant="ghost" size="icon-sm" asChild aria-label="Notification preferences">
                <Link href="/dashboard/settings/notifications" onClick={() => setOpen(false)}>
                  <Settings2 />
                </Link>
              </Button>
            </div>
            <PopoverDescription>
              {unread ? `${unread} unread in your inbox` : "Your latest account and product updates"}
            </PopoverDescription>
          </PopoverHeader>
          {error ? (
            <ResourceState loading={false} error={error} retry={() => void refresh()} />
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!unread || pending}
                onClick={() => void mutate("/notifications/read-all", undefined, "POST")}
              >
                <CheckCheck data-icon="inline-start" />
                Mark all as read
              </Button>
              <ResourceState {...feed} retry={feed.reload} />
              {!feed.loading &&
                !feed.error &&
                (feed.data?.items.length ? (
                  <ScrollArea className="h-80 max-h-[60svh]">
                    <ItemGroup className="pr-3">
                      {feed.data.items.map((item) => (
                        <NotificationRow key={item.id} item={item} compact onSelect={select} />
                      ))}
                    </ItemGroup>
                  </ScrollArea>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Bell />
                      </EmptyMedia>
                      <EmptyTitle>You’re all caught up</EmptyTitle>
                      <EmptyDescription>New account and product messages will appear here.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ))}
            </>
          )}
          <Separator />
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
              View notification center
            </Link>
          </Button>
        </PopoverContent>
      </Popover>
      <NotificationDetail item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
