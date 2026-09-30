"use client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { CollectionSearch, FilterSelect } from "../../_components/collection-filters";
import { ApiCapabilities } from "../../api/_components/api-capabilities";
import { getKeyStatus } from "../../api/_components/key-status";
import { AdminCollectionCard, useAdminCollection } from "./admin-collection";
import type { AdminKeyRow } from "./admin-types";
export function AdminKeys() {
  const resource = useAdminCollection<AdminKeyRow>("api-keys");
  return (
    <div className="flex flex-col gap-5">
      <AdminCollectionCard
        title="API key inventory"
        description="All accounts’ credentials and lifetime recorded requests. Only prefixes are visible."
        resource={resource}
        toolbar={
          <>
            <CollectionSearch
              value={resource.search}
              onChange={resource.setSearch}
              placeholder="Key name, prefix or owner"
            />
            <FilterSelect
              label="Key status"
              value={resource.filters.status ?? "all"}
              options={[
                ["all", "All keys"],
                ["ACTIVE", "Active"],
                ["REVOKED", "Revoked"],
              ]}
              onChange={(v) => resource.setFilter("status", v)}
            />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Key</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Last used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resource.data?.items.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="py-4 pl-6">
                  <p className="font-medium">{key.name}</p>
                  <code className="text-muted-foreground text-xs">{key.prefix}••••</code>
                </TableCell>
                <TableCell>{key.user.email}</TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getKeyStatus(key)}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{key._count.usage.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCollectionCard>
      <ApiCapabilities />
    </div>
  );
}
