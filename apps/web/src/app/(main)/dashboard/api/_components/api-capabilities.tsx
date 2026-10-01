"use client";
import Link from "next/link";

import { ArrowUpRight, BellRing, Bookmark, BookOpen, CandlestickChart, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";
import type { ApiCatalog } from "./api-types";

const icons = {
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
            {resource.data?.endpoints.map((endpoint) => {
              const Icon = icons[endpoint.scope as keyof typeof icons] ?? ArrowUpRight;
              return (
                <div key={`${endpoint.method}:${endpoint.path}`} className="flex gap-3 rounded-lg border p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="font-medium text-sm">{endpoint.title}</p>
                    <p className="text-muted-foreground text-sm">{endpoint.description}</p>
                    <div>
                      <Badge variant="outline">{endpoint.scope}</Badge>
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
