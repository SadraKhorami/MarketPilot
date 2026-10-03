"use client";
import { useEffect, useState } from "react";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { SystemSection } from "./system-section";
import { useSystemRefresh } from "./use-system-refresh";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";
import { type DeliveryRecord, deliveryLabels, deliveryReason } from "@/lib/bots/deliveries";

import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";

interface AdminDelivery extends DeliveryRecord {
  provider: string;
  adminRetries: number;
}
export function AdminBotDeliveries() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const resource = useApiResource<PagedResult<AdminDelivery>>(
    `/admin/bots/deliveries?page=${page}&pageSize=${pageSize}`,
    { keepDataOnReload: true },
  );
  useSystemRefresh(resource.reload);
  useEffect(() => {
    if (resource.data && page > Math.max(1, resource.data.totalPages)) setPage(Math.max(1, resource.data.totalPages));
  }, [resource.data, page]);
  async function retry(id: string) {
    setBusy(id);
    try {
      await apiRequest(`/admin/bots/deliveries/${id}/retry`, { method: "POST" });
      resource.reload();
      toast.success("Delivery recovery requested.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry delivery.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <SystemSection
      title="Delivery recovery"
      description="Review failed external deliveries"
      icon={Send}
      defaultOpen={false}
    >
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <p className="text-muted-foreground text-xs">
          Retry definitive failures up to three times after fixing the cause. Unknown acceptance is not automatically
          replayed.
        </p>
        <ResourceState {...resource} retry={resource.reload} />
        {resource.data && !resource.error ? (
          <>
            {resource.data.items.length ? (
              <div className="flex flex-col divide-y">
                {resource.data.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex w-full min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">
                        {item.trigger.assetId} · {item.provider} · {deliveryLabels[item.status] ?? item.status}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(item.createdAt).toLocaleString()} · {item.attempts} attempts · {item.adminRetries}{" "}
                        manual retries
                      </p>
                      <p className="mt-1 text-muted-foreground text-sm">{deliveryReason(item.failureCode)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">{item.status}</Badge>
                      {item.status === "failed" && item.adminRetries < 3 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => void retry(item.id)}
                        >
                          Retry delivery
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No external deliveries</EmptyTitle>
                  <EmptyDescription>
                    Delivery records appear when opted-in linked accounts have a new saved-rule crossing.
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
      </div>
    </SystemSection>
  );
}
