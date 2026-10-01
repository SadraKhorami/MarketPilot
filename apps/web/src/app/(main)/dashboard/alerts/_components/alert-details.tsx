"use client";
import { useEffect, useState } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";

import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import {
  type AlertRecord,
  conditionLabel,
  dateLabel,
  numberLabel,
  reasonLabel,
  type TriggerRecord,
} from "./alert-types";

function deliveryLabel(item: TriggerRecord) {
  if (item.deliveryStatus === "delivered") return "Inbox delivered";
  if (item.deliveryStatus === "suppressed") return "Inbox skipped";
  return item.failureCode ? "Inbox needs recovery" : "Inbox pending";
}
export function AlertDetails({ id, close }: { id: string | null; close: () => void }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const rule = useApiResource<AlertRecord>(id ? `/alerts/${id}` : null, { keepDataOnReload: true });
  const history = useApiResource<PagedResult<TriggerRecord>>(
    id ? `/alerts/${id}/history?page=${page}&pageSize=${pageSize}` : null,
    { keepDataOnReload: true },
  );
  useEffect(() => {
    if (!id) return;
    const timer = window.setInterval(() => {
      rule.reload();
      history.reload();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [id, rule.reload, history.reload]);
  const data = rule.data;
  return (
    <Dialog
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "Alert details"}</DialogTitle>
          <DialogDescription>
            Rule status and trigger history · {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </DialogDescription>
        </DialogHeader>
        <ResourceState {...rule} retry={rule.reload} />
        {data && !rule.error && !rule.loading ? (
          <div className="flex flex-col gap-4">
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {data.assetId} · {conditionLabel(data)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {data.interval} candles · {data.cooldownMinutes} minute cooldown
                </p>
              </div>
              <Badge variant={data.enabled ? "default" : "outline"}>{data.enabled ? "Active" : "Paused"}</Badge>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Created", dateLabel(data.createdAt)],
                ["Last evaluation", dateLabel(data.lastEvaluatedAt)],
                ["Last trigger", dateLabel(data.lastTriggeredAt)],
                ["Evaluation", reasonLabel(data.evaluationReason)],
                ["Latest value", data.lastValue === null ? "Not observed" : numberLabel(data.lastValue)],
                ["Observation time", dateLabel(data.lastObservationAt)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <Link className="underline underline-offset-4" href="/dashboard/settings">
                Inbox preferences
              </Link>
              <Link className="underline underline-offset-4" href="/dashboard/bots/telegram">
                Telegram delivery
              </Link>
              <Link className="underline underline-offset-4" href="/dashboard/bots/discord">
                Discord delivery
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-medium">Trigger history</h3>
              <ResourceState {...history} retry={history.reload} />
              {!history.loading && !history.error && history.data ? (
                <>
                  {history.data.items.length ? (
                    <div className="flex flex-col divide-y">
                      {history.data.items.map((item) => (
                        <div key={item.id} className="flex flex-col gap-2 py-3">
                          <div className="flex w-full flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">{conditionLabel(item)}</p>
                              <p className="text-sm">
                                Observed {numberLabel(item.value)} {item.unit}
                              </p>
                            </div>
                            <Badge variant="outline">{deliveryLabel(item)}</Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {dateLabel(item.triggeredAt)} · Observed {dateLabel(item.observationAt)}
                            <br />
                            {item.source} · {item.providerSymbol} · {item.interval} ·{" "}
                            {item.priceKind === "quote" ? "Provider quote" : "Completed candle"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>No triggers yet</EmptyTitle>
                        <EmptyDescription>
                          The first observation sets a baseline. Later crossings appear here.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  <CollectionPagination
                    page={page}
                    pageSize={pageSize}
                    total={history.data.total}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
