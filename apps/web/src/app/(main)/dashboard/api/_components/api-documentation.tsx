"use client";

import Link from "next/link";

import { ExternalLink } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";
import { ApiRequestExamples } from "./api-request-examples";
import type { ApiCatalog } from "./api-types";

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");

export function ApiDocumentation() {
  const resource = useApiResource<ApiCatalog>("/api-keys/catalog");
  const catalog = resource.data;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Alert className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <AlertTitle>Read access for your integrations</AlertTitle>
          <AlertDescription>
            Send <code>Authorization: Bearer YOUR_API_KEY</code> from your server or scripts. Create a key with only the
            permissions you need and save its secret when it is shown.
          </AlertDescription>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 self-start">
          <Link href="/dashboard/api/keys">Manage keys</Link>
        </Button>
      </Alert>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-muted-foreground text-sm">
          Base URL: <code className="break-all text-xs">{baseUrl}</code>
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`${baseUrl}/docs`} target="_blank" rel="noreferrer">
              OpenAPI reference <ExternalLink data-icon="inline-end" />
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={`${baseUrl}/openapi.json`} target="_blank" rel="noreferrer">
              JSON schema <ExternalLink data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {!resource.loading && !resource.error && catalog && (
        <>
          <ApiRequestExamples catalog={catalog} baseUrl={baseUrl} />
          <Card>
            <CardHeader>
              <CardTitle>Available endpoints</CardTitle>
              <CardDescription>Paths are relative to the base URL. All reads require the listed scope.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Endpoint / scope</TableHead>
                    <TableHead>Parameters & response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.endpoints.map((endpoint) => (
                    <TableRow key={`${endpoint.method}:${endpoint.path}`}>
                      <TableCell className="py-4 pl-4 align-top">
                        <p className="font-medium">{endpoint.title}</p>
                        <code className="my-2 block text-xs">
                          {endpoint.method} {endpoint.path}
                        </code>
                        <Badge variant="outline">{endpoint.scope}</Badge>
                      </TableCell>
                      <TableCell className="min-w-64 whitespace-normal py-4 pr-4 align-top">
                        <p className="text-sm">{endpoint.description}</p>
                        <p className="mt-2 text-muted-foreground text-xs">{endpoint.parameters}</p>
                        <code className="mt-2 block break-words text-xs">{endpoint.response}</code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Responses & observed data</CardTitle>
                <CardDescription>Read source and time metadata alongside every market value.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p>
                  Successful reads return <code>{'{ "data": … }'}</code>. Market snapshots contain a second{" "}
                  <code>data</code> object for the observation: <code>body.data.data.price</code> and{" "}
                  <code>body.data.data.indicators</code>.
                </p>
                <p className="text-muted-foreground">
                  Prices use the instrument’s quote currency. <code>priceKind</code> distinguishes a trade quote from a
                  candle close. <code>timestamp</code> is the observation time; <code>fetchedAt</code> is retrieval
                  time. Fresh cache entries can be up to 60 seconds old; stale fallback is explicitly marked and
                  retained up to 15 minutes. Fresh does not guarantee real-time exchange data.
                </p>
                <p className="text-muted-foreground">
                  Candles are oldest first, up to 300 per read. Missing indicators, volume or market-open status remain
                  null. Catalog discovery can be partial: check <code>error</code> and <code>stale</code>. Configured
                  instruments can still fail upstream.
                </p>
                <p className="text-muted-foreground">
                  News contains original source links, publication and fetch times. Empty results can reflect disabled
                  ingestion. Asset matching uses tags or keywords; sentiment scores are unavailable.
                </p>
                <p>
                  Pagination starts at 1, defaults to 20 rows and accepts up to 50. News uses <code>data.articles</code>
                  ; alerts and trigger history use <code>data.items</code>. Both return <code>total</code>,{" "}
                  <code>page</code>, <code>pageSize</code> and <code>totalPages</code>. Empty collections have zero
                  total pages.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Limits & recovery</CardTitle>
                <CardDescription>
                  {catalog.rateLimit.requests} requests per {catalog.rateLimit.windowSeconds} seconds per key
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p>
                  Each key has its own fixed window starting with its first request. Authenticated rejected requests
                  also count. Read <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Window</code> (seconds),{" "}
                  <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Reset</code> (Unix seconds).
                </p>
                <p className="text-muted-foreground">
                  On 429, wait for <code>Retry-After</code> seconds before retrying. These headers describe the bucket
                  at response time. Daily plan allowances are shown in Billing. <code>X-RateLimit-Mode</code> is{" "}
                  <code>redis</code> normally; <code>local</code> identifies per-process outage fallback, which is not
                  shared across replicas.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-5">
                  <code>{`HTTP/1.1 429 Too Many Requests\nRetry-After: 42\n\n{"error":{"code":"RATE_LIMITED",\n "message":"Too many requests. Retry in 42 seconds.",\n "retryAfterSeconds":42},"requestId":"…"}`}</code>
                </pre>
                <dl className="flex flex-col gap-2">
                  {[
                    ["400", "VALIDATION_ERROR or unsupported market: fix parameters."],
                    ["401", "UNAUTHENTICATED: use a valid, active, unexpired key."],
                    ["403", "API_SCOPE_REQUIRED: check scope; session-only routes reject keys."],
                    ["404", "Owned resource not found: check the ID and account."],
                    ["503", "Market/provider unavailable: retry later; do not invent missing values."],
                    ["500", "Unexpected error: retain the request ID for support."],
                  ].map(([status, description]) => (
                    <div key={status} className="flex items-start gap-2">
                      <dt>
                        <Badge variant="outline">{status}</Badge>
                      </dt>
                      <dd className="text-muted-foreground">{description}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
          <p className="text-muted-foreground text-sm">
            Keys cannot access AI research, account management, linking, administration or write operations. Trading,
            billing and sentiment endpoints are not available to API keys. Usage records exclude browser and internal
            bot/provider traffic; invalid credentials cannot be attributed to an account.
          </p>
        </>
      )}
    </div>
  );
}
