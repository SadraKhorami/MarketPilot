"use client";
import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { alertMetric, MarketAlertDetails } from "./market-alert-report";
import { categoryLabels, type NotificationRecord, severityLabels } from "./notification-types";
export function NotificationDetail({ item, onClose }: { item: NotificationRecord | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Notification details</SheetTitle>
          <SheetDescription>
            {item ? new Date(item.createdAt).toLocaleString() : "Notification details"}
          </SheetDescription>
        </SheetHeader>
        {item && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 px-4 pb-6">
              <Item variant="outline" className="items-start">
                <ItemContent className="min-w-0 gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{categoryLabels[item.category]}</Badge>
                    <Badge variant={item.severity === "CRITICAL" ? "destructive" : "secondary"}>
                      {severityLabels[item.severity]}
                    </Badge>
                  </div>
                  <ItemTitle className="line-clamp-none [overflow-wrap:anywhere]">
                    {item.category === "MARKET_ALERT" && item.marketAlert
                      ? `${item.marketAlert.assetId} · ${alertMetric(item.marketAlert)} alert`
                      : item.title}
                  </ItemTitle>
                  {item.category === "MARKET_ALERT" && item.marketAlert ? (
                    <MarketAlertDetails report={item.marketAlert} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{item.body}</p>
                  )}
                </ItemContent>
              </Item>
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
