"use client";
import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { categoryLabels, type NotificationRecord, severityLabels } from "./notification-types";
export function NotificationDetail({ item, onClose }: { item: NotificationRecord | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{item?.title ?? "Notification"}</SheetTitle>
          <SheetDescription>
            {item ? new Date(item.createdAt).toLocaleString() : "Notification details"}
          </SheetDescription>
        </SheetHeader>
        {item && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 px-4 pb-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{categoryLabels[item.category]}</Badge>
                <Badge variant={item.severity === "CRITICAL" ? "destructive" : "secondary"}>
                  {severityLabels[item.severity]}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</p>
              {item.actionPath && (
                <Button asChild variant="outline">
                  <Link href={item.actionPath} onClick={onClose}>
                    Open related page <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
