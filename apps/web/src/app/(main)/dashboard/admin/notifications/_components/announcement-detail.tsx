"use client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { AnnouncementPreview } from "./announcement-preview";
import { type AnnouncementRecord, audienceLabels } from "./announcement-types";
export function AnnouncementDetail({ item, onClose }: { item: AnnouncementRecord | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Announcement details</SheetTitle>
          <SheetDescription>Message content and recorded in-app delivery.</SheetDescription>
        </SheetHeader>
        {item && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 px-4 pb-6">
              <AnnouncementPreview {...item} />
              <Badge variant="outline">{item.status.toLowerCase()}</Badge>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Audience</dt>
                  <dd>{audienceLabels[item.audience]}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Author</dt>
                  <dd className="break-all">{item.author?.name ?? item.author?.email ?? "Former administrator"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{new Date(item.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Published</dt>
                  <dd>{item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "Not published"}</dd>
                </div>
              </dl>
              {item.status === "PUBLISHED" && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="font-semibold text-2xl tabular-nums">{item.recipientCount}</p>
                    <p className="text-muted-foreground text-xs">Delivered</p>
                  </div>
                  <div>
                    <p className="font-semibold text-2xl tabular-nums">{item.readCount}</p>
                    <p className="text-muted-foreground text-xs">Currently read</p>
                  </div>
                  <div>
                    <p className="font-semibold text-2xl tabular-nums">{item.excludedCount}</p>
                    <p className="text-muted-foreground text-xs">Opted out</p>
                  </div>
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                Delivery means stored in the account inbox. This does not send email, Telegram, Discord or device push
                notifications.
              </p>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
