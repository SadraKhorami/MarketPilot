"use client";
import { cn } from "cn";
import { Archive, ArchiveRestore, BellRing, Check, Eye, Mail, Megaphone, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemMedia } from "@/components/ui/item";

import { alertMetric, alertSummary, alertValue, observationTime } from "./market-alert-report";
import { useNotifications } from "./notification-provider";
import { categoryLabels, type NotificationRecord } from "./notification-types";

const icons = { SECURITY: ShieldCheck, ACCOUNT: UserRound, ANNOUNCEMENT: Megaphone, MARKET_ALERT: BellRing };
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
  const report = item.category === "MARKET_ALERT" ? item.marketAlert : null;
  const title = report ? `${report.assetId} · ${alertMetric(report)} alert` : item.title;
  return (
    <Item role="listitem" variant={item.readAt ? "outline" : "muted"} className="items-start">
      <ItemMedia variant="icon" className={cn("mt-1", item.severity === "CRITICAL" && "text-destructive")}>
        <Icon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <button
          type="button"
          onClick={() => onSelect(item)}
          aria-label={`Read notification: ${item.title}`}
          className="flex w-full cursor-pointer flex-col gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-medium text-sm [overflow-wrap:anywhere]">{title}</span>
          <span className="line-clamp-2 text-muted-foreground text-sm leading-normal [overflow-wrap:anywhere]">
            {report ? alertSummary(report) : item.body}
          </span>
          {report && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium tabular-nums">Recorded {alertValue(report.value, report.unit)}</span>
              <span className="text-muted-foreground text-xs">
                {report.interval} · <time dateTime={report.observationAt}>{observationTime(report.observationAt)}</time>
              </span>
            </span>
          )}
          <span className="flex flex-wrap items-center gap-2">
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
          </span>
        </button>
      </ItemContent>
      {!compact && (
        <ItemActions className="ml-auto flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => onSelect(item)} aria-label={`Details for ${item.title}`}>
            <Eye data-icon="inline-start" />
            Details
          </Button>
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
