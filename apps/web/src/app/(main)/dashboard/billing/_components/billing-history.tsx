"use client";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";

import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import type { PaymentRow } from "./billing-types";
import { PaymentTable } from "./payment-table";
export function BillingHistory() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const resource = useApiResource<PagedResult<PaymentRow>>(`/billing/payments?page=${page}&pageSize=${pageSize}`);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Test payment history</CardTitle>
        <CardDescription>Sandbox transactions and demo activations. These are not real payments.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ResourceState {...resource} retry={resource.reload} />
        {!resource.loading &&
          !resource.error &&
          (resource.data?.items.length ? (
            <PaymentTable items={resource.data.items} />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No test payments yet</EmptyTitle>
                <EmptyDescription>Try Pro from the Plans tab to explore the billing flow.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ))}
      </CardContent>
      <CollectionPagination
        page={page}
        pageSize={pageSize}
        total={resource.data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </Card>
  );
}
