"use client";
import { type ReactNode, useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";

import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";

export function useAdminCollection<T>(
  endpoint: string,
  { includePeriod = true, keepDataOnReload = false }: { includePeriod?: boolean; keepDataOnReload?: boolean } = {},
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<{ [key: string]: string | undefined }>(includePeriod ? { days: "7" } : {});
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (debouncedSearch.trim()) query.set("search", debouncedSearch.trim());
  const resource = useApiResource<PagedResult<T>>(`/admin/${endpoint}?${query}`, { keepDataOnReload });
  return {
    ...resource,
    page,
    pageSize,
    search,
    setSearch,
    filters,
    setFilter: (name: string, value: string) => {
      setFilters((current) => {
        const next = { ...current };
        if (value === "all") delete next[name];
        else next[name] = value;
        return next;
      });
      setPage(1);
    },
    pagination: {
      page,
      pageSize,
      total: resource.data?.total ?? 0,
      onPageChange: setPage,
      onPageSizeChange: (size: number) => {
        setPageSize(size);
        setPage(1);
      },
    },
  };
}
export function AdminCollectionCard({
  title,
  description,
  toolbar,
  resource,
  children,
}: {
  title: string;
  description: string;
  toolbar: ReactNode;
  resource: {
    loading: boolean;
    error: string | null;
    reload: () => void;
    data: { items: unknown[] } | null;
    pagination: React.ComponentProps<typeof CollectionPagination>;
  };
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">{toolbar}</div>
      </CardHeader>
      <CardContent className="px-0">
        <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload} />
        {!resource.loading &&
          !resource.error &&
          (resource.data?.items.length ? (
            children
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No matching records</EmptyTitle>
                <EmptyDescription>Try another search or widen your filters.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ))}
      </CardContent>
      <CollectionPagination {...resource.pagination} />
    </Card>
  );
}
