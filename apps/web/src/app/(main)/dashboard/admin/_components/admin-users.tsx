"use client";
import { useState } from "react";

import { ArrowUpRight, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";

import { CollectionSearch, FilterSelect } from "../../_components/collection-filters";
import { ResourceState } from "../../_components/resource-state";
import { AdminCollectionCard, useAdminCollection } from "./admin-collection";
import type { AccountRow } from "./admin-types";

export function AdminUsers() {
  const resource = useAdminCollection<AccountRow>("users");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <>
      <AdminCollectionCard
        title="Account directory"
        description="Review account access and saved resources."
        resource={resource}
        toolbar={
          <>
            <CollectionSearch
              value={resource.search}
              onChange={resource.setSearch}
              placeholder="Search name or email"
            />
            <FilterSelect
              label="Account status"
              value={resource.filters.status ?? "all"}
              options={[
                ["all", "All statuses"],
                ["ACTIVE", "Active"],
                ["DISABLED", "Disabled"],
              ]}
              onChange={(value) => resource.setFilter("status", value)}
            />
            <FilterSelect
              label="Account role"
              value={resource.filters.role ?? "all"}
              options={[
                ["all", "All roles"],
                ["ADMIN", "Admin"],
                ["USER", "User"],
              ]}
              onChange={(value) => resource.setFilter("role", value)}
            />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Account</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resources</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resource.data?.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="py-4 pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{(user.name ?? user.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{user.name ?? "Unnamed account"}</span>
                      <span className="text-muted-foreground text-xs">{user.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {user.roles.map(({ role }) => (
                      <Badge variant={role.name === "ADMIN" ? "default" : "secondary"} key={role.name}>
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{user.status}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-xs">
                    {user._count.watchlists} lists · {user._count.alerts} alerts · {user._count.apiKeys} keys
                  </span>
                </TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`View ${user.email}`}
                    onClick={() => setSelectedId(user.id)}
                  >
                    <ArrowUpRight />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCollectionCard>
      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="overflow-y-auto">{selectedId && <UserDetails id={selectedId} />}</SheetContent>
      </Sheet>
    </>
  );
}
function UserDetails({ id }: { id: string }) {
  const resource = useApiResource<
    AccountRow & { activity: Array<{ id: string; description: string; occurredAt: string }> }
  >(`/admin/users/${id}`);
  const user = resource.data;
  return (
    <>
      <SheetHeader>
        <SheetTitle>Account details</SheetTitle>
        <SheetDescription>Read-only account review</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        <ResourceState {...resource} retry={resource.reload} />
        {!resource.loading && !resource.error && user && (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback>
                  <Users />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold">{user.name ?? "Unnamed account"}</p>
                <p className="break-all text-muted-foreground text-sm">{user.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{user.status}</Badge>
              {user.roles.map(({ role }) => (
                <Badge key={role.name}>{role.name}</Badge>
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-4">
              {[
                ["Watchlists", user._count.watchlists],
                ["Alerts", user._count.alerts],
                ["API keys", user._count.apiKeys],
                ["Audit events", user._count.activity ?? 0],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="mt-1 font-semibold text-xl tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <Separator />
            <p className="font-medium text-sm">Recent activity</p>
            {user.activity.map((event) => (
              <div key={event.id} className="flex flex-col gap-1">
                <p className="text-sm">{event.description}</p>
                <time className="text-muted-foreground text-xs">{new Date(event.occurredAt).toLocaleString()}</time>
              </div>
            ))}
            {!user.activity.length && <p className="text-muted-foreground text-sm">No account events recorded.</p>}
          </>
        )}
      </div>
    </>
  );
}
