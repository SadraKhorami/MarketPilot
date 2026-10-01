"use client";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";
import type { ApiCatalog } from "./api-types";

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const example = `curl "${baseUrl}/market-data/BTC-USD?interval=15m" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;
export function ApiDocumentation() {
  const resource = useApiResource<ApiCatalog>("/api-keys/catalog");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
      toast.success("Example copied.");
    } catch {
      toast.error("Select the example to copy it manually.");
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Make your first request</CardTitle>
          <CardDescription>
            Create a key with market:read, then replace YOUR_API_KEY in your own environment.
          </CardDescription>
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              <Copy data-icon="inline-start" />
              Copy
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">
            <code>{example}</code>
          </pre>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Base URL: <code className="break-all text-xs">{baseUrl}</code>
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={`${baseUrl}/docs`} target="_blank" rel="noreferrer">
                OpenAPI reference <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
      <ResourceState {...resource} retry={resource.reload} />
      {!resource.loading && !resource.error && resource.data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {resource.data.endpoints.map((endpoint) => (
              <Card key={`${endpoint.method}:${endpoint.path}`}>
                <CardHeader>
                  <CardTitle>{endpoint.title}</CardTitle>
                  <CardDescription>{endpoint.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{endpoint.method}</Badge>
                    <code className="break-all text-xs">{endpoint.path}</code>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    {endpoint.scope}
                  </Badge>
                  <p className="text-muted-foreground text-xs">Parameters: {endpoint.parameters}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Authentication & responses</CardTitle>
              <CardDescription>Developer API access is read-only and scoped to the key owner.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <p className="text-sm">
                  Send <code className="text-xs">Authorization: Bearer YOUR_API_KEY</code>. Store the secret on your
                  server; account and administration endpoints require browser authentication.
                </p>
                <p className="text-muted-foreground text-sm">
                  {resource.data.rateLimit.requests} requests per {resource.data.rateLimit.windowSeconds} seconds per
                  key. Dashboard traffic is reported separately from key usage.
                </p>
              </div>
              <dl className="flex flex-col gap-3 text-sm">
                {[
                  ["200", "Success: { data: … }"],
                  ["400", "Invalid parameters"],
                  ["401", "Missing, expired or revoked credentials"],
                  ["403", "Required scope is missing"],
                  ["429", "Rate limit reached; retry after the current window"],
                  ["502 / 503", "Provider or service temporarily unavailable"],
                ].map(([status, detail]) => (
                  <div key={status} className="flex gap-3">
                    <dt>
                      <Badge variant="outline">{status}</Badge>
                    </dt>
                    <dd className="text-muted-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
