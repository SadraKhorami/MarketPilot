"use client";
import { cn } from "cn";
import { Archive, ArchiveRestore, Check, Mail, Megaphone, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia } from "@/components/ui/item";

import { useNotifications } from "./notification-provider";
import { categoryLabels, type NotificationRecord } from "./notification-types";

const icons = { SECURITY: ShieldCheck, ACCOUNT: UserRound, ANNOUNCEMENT: Megaphone };
function relativeTime(value: string) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  if (Math.abs(minutes) < 1440) return formatter.format(Math.round(minutes / 60), "hour");
  return formatter.format(Math.round(minutes / 1440), "day");
}
export function NotificationRow({
  item,
  compact = false,
  onSelect,
}: {
  item: NotificationRecord;
  compact?: boolean;
  onSelect: (item: NotificationRecord) => void;
}) {
  const { pending, mutate } = useNotifications();
  const Icon = icons[item.category];
  return (
    <Item role="listitem" variant={item.readAt ? "outline" : "muted"} className="items-start">
      <ItemMedia variant="icon" className={cn("mt-1", item.severity === "CRITICAL" && "text-destructive")}>
        <Icon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="flex flex-col gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="break-words font-medium text-sm">{item.title}</span>
        </button>
        <ItemDescription>{item.body}</ItemDescription>
        <div className="flex flex-wrap items-center gap-2">
          {!item.readAt && <Badge variant="secondary">New</Badge>}
          {!compact && <Badge variant="outline">{categoryLabels[item.category]}</Badge>}
          {item.severity !== "INFO" && (
            <Badge variant={item.severity === "CRITICAL" ? "destructive" : "outline"}>
              {item.severity === "CRITICAL" ? "Urgent" : "Important"}
            </Badge>
          )}
          <time
            className="text-muted-foreground text-xs"
            dateTime={item.createdAt}
            title={new Date(item.createdAt).toLocaleString()}
          >
            {relativeTime(item.createdAt)}
          </time>
        </div>
      </ItemContent>
      {!compact && (
        <ItemActions className="ml-auto">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={item.readAt ? `Mark ${item.title} unread` : `Mark ${item.title} read`}
            title={item.readAt ? "Mark unread" : "Mark read"}
            onClick={() => void mutate(`/notifications/${item.id}`, { read: !item.readAt })}
          >
            {item.readAt ? <Mail /> : <Check />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={item.archivedAt ? `Restore ${item.title}` : `Archive ${item.title}`}
            title={item.archivedAt ? "Restore to inbox" : "Archive"}
            onClick={() => void mutate(`/notifications/${item.id}`, { archived: !item.archivedAt })}
          >
            {item.archivedAt ? <ArchiveRestore /> : <Archive />}
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}
