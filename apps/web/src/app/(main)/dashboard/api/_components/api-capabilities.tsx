"use client";
import Link from "next/link";

import { ArrowUpRight, BellRing, Bookmark, BookOpen, CandlestickChart, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";
import type { ApiCatalog } from "./api-types";

const icons: Record<string, typeof ArrowUpRight> = {
  "market:read": CandlestickChart,
  "news:read": Newspaper,
  "watchlists:read": Bookmark,
  "alerts:read": BellRing,
};
export function ApiCapabilities() {
  const resource = useApiResource<ApiCatalog>("/api-keys/catalog");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Build with MarketPilot</CardTitle>
        <CardDescription>Read market intelligence and your saved resources from your own tools.</CardDescription>
        <CardAction>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/api/documentation">
              <BookOpen data-icon="inline-start" /> API guide
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ResourceState {...resource} retry={resource.reload} />
        {!resource.loading && !resource.error && (
          <div className="grid gap-4 md:grid-cols-2">
            {resource.data?.scopes.map((scope) => {
              const Icon = icons[scope.id] ?? ArrowUpRight;
              return (
                <div key={scope.id} className="flex gap-3 rounded-lg border p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="font-medium text-sm">{scope.title}</p>
                    <p className="text-muted-foreground text-sm">
                      {resource.data?.endpoints.filter((endpoint) => endpoint.scope === scope.id).length} documented
                      read endpoints
                    </p>
                    <div>
                      <Badge variant="outline">{scope.id}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
