import { Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";

import type { NotificationSeverity } from "../../../notifications/_components/notification-types";
import { severityLabels } from "../../../notifications/_components/notification-types";
import { destinations } from "./announcement-types";
export function AnnouncementPreview({
  title,
  body,
  severity,
  actionPath,
}: {
  title: string;
  body: string;
  severity: NotificationSeverity;
  actionPath: string | null;
}) {
  return (
    <Item variant="outline" className="items-start">
      <ItemMedia variant="icon">
        <Megaphone />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-3">
        <Badge variant={severity === "CRITICAL" ? "destructive" : "secondary"}>{severityLabels[severity]}</Badge>
        <ItemTitle className="line-clamp-none break-words">{title || "Your announcement title"}</ItemTitle>
        <p className="whitespace-pre-wrap break-words text-muted-foreground text-sm">
          {body || "Write a clear message and explain any action users need to take."}
        </p>
        {actionPath && (
          <p className="font-medium text-xs">
            Links to: {destinations.find(([path]) => path === actionPath)?.[1] ?? "Workspace"}
          </p>
        )}
      </ItemContent>
    </Item>
  );
}
