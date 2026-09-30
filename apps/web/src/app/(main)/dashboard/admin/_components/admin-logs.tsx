"use client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { CollectionSearch, FilterSelect, rangeOptions } from "../../_components/collection-filters";
import { AdminCollectionCard, useAdminCollection } from "./admin-collection";
import type { AuditRow, RequestRow } from "./admin-types";

export function AdminRequests() {
  const resource = useAdminCollection<RequestRow>("requests");
  return (
    <AdminCollectionCard
      title="Authenticated request log"
      description="Browser sessions and API keys are recorded separately. Anonymous traffic is not included; request bodies and credentials are never recorded."
      resource={resource}
      toolbar={
        <>
          <CollectionSearch
            value={resource.search}
            onChange={resource.setSearch}
            placeholder="Route, request ID or account"
          />
          <FilterSelect
            label="Authentication method"
            value={resource.filters.authType ?? "all"}
            options={[
              ["all", "All traffic"],
              ["SESSION", "Browser sessions"],
              ["API_KEY", "API keys"],
            ]}
            onChange={(v) => resource.setFilter("authType", v)}
          />
          <FilterSelect
            label="Request outcome"
            value={resource.filters.outcome ?? "all"}
            options={[
              ["all", "All responses"],
              ["success", "Successful"],
              ["error", "Errors (4xx / 5xx)"],
            ]}
            onChange={(v) => resource.setFilter("outcome", v)}
          />
          <FilterSelect
            label="Date range"
            value={resource.filters.days ?? "7"}
            options={rangeOptions}
            onChange={(v) => resource.setFilter("days", v)}
          />
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Request</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Authentication</TableHead>
            <TableHead>Response</TableHead>
            <TableHead>Latency</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resource.data?.items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="py-4 pl-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{row.method}</Badge>
                  <code className="text-xs">{row.route}</code>
                </div>
                <p className="mt-1 font-mono text-muted-foreground text-xs">{row.requestId}</p>
              </TableCell>
              <TableCell>{row.user.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">{row.authType === "SESSION" ? "Browser session" : "API key"}</Badge>
                {row.apiKey && <p className="mt-1 text-muted-foreground text-xs">{row.apiKey.name}</p>}
              </TableCell>
              <TableCell>
                <Badge variant={row.statusCode >= 400 ? "destructive" : "outline"}>{row.statusCode}</Badge>
              </TableCell>
              <TableCell className="tabular-nums">{row.latencyMs} ms</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                {new Date(row.occurredAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminCollectionCard>
  );
}
export function AdminAudit() {
  const resource = useAdminCollection<AuditRow>("activity");
  return (
    <AdminCollectionCard
      title="Account audit trail"
      description="Recorded sign-ins, resource changes and account preferences across the workspace."
      resource={resource}
      toolbar={
        <>
          <CollectionSearch
            value={resource.search}
            onChange={resource.setSearch}
            placeholder="Search event or account"
          />
          <FilterSelect
            label="Date range"
            value={resource.filters.days ?? "7"}
            options={rangeOptions}
            onChange={(v) => resource.setFilter("days", v)}
          />
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Event</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resource.data?.items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="py-4 pl-6 font-medium">{row.description}</TableCell>
              <TableCell>{row.user.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">{row.eventType.toLowerCase().replaceAll("_", " ")}</Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                {new Date(row.occurredAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminCollectionCard>
  );
}
