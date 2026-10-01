"use client";
import { useEffect, useState } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";
import { type DeliveryRecord, deliveryLabels, deliveryReason } from "@/lib/bots/deliveries";

import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import type { Provider } from "./bot-types";

export function BotDeliveryHistory({ provider }: { provider: Provider }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const resource = useApiResource<PagedResult<DeliveryRecord>>(
    `/bots/${provider}/deliveries?page=${page}&pageSize=${pageSize}`,
    { keepDataOnReload: true },
  );
  useEffect(() => {
    const timer = window.setInterval(resource.reload, 15000);
    return () => window.clearInterval(timer);
  }, [resource.reload]);
  useEffect(() => {
    if (resource.data && page > Math.max(1, resource.data.totalPages)) setPage(Math.max(1, resource.data.totalPages));
  }, [resource.data, page]);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Market alert deliveries</CardTitle>
        <CardDescription>Independent delivery status for this platform. Updates every 15 seconds.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <ResourceState {...resource} retry={resource.reload} />
        {resource.data && !resource.error ? (
          <>
            {resource.data.items.length ? (
              <div className="flex flex-col divide-y">
                {resource.data.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex w-full min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        className="font-medium text-sm underline-offset-4 hover:underline"
                        href={`/dashboard/alerts?alert=${item.trigger.alertId}`}
                      >
                        {item.trigger.assetId} · {item.trigger.condition?.replaceAll("_", " ")}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {new Date(item.createdAt).toLocaleString()} · {item.attempts} attempts
                      </p>
                      {deliveryReason(item.failureCode) ? (
                        <p className="mt-1 text-muted-foreground text-sm">{deliveryReason(item.failureCode)}</p>
                      ) : null}
                      {item.status === "retry" ? (
                        <p className="text-muted-foreground text-xs">
                          Next attempt: {new Date(item.nextAttemptAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      className="shrink-0 self-start"
                      variant={item.status === "failed" || item.status === "unknown" ? "destructive" : "outline"}
                    >
                      {deliveryLabels[item.status] ?? item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No deliveries yet</EmptyTitle>
                  <EmptyDescription>
                    After you link an account and enable market alerts, new saved-rule crossings appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <CollectionPagination
              page={page}
              pageSize={pageSize}
              total={resource.data.total}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
