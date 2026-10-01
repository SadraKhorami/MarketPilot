"use client";
import { FlaskConical } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks/use-api-resource";

import { CollectionSearch, FilterSelect } from "../../_components/collection-filters";
import { ResourceState } from "../../_components/resource-state";
import type { PaymentRow } from "../../billing/_components/billing-types";
import { PaymentTable } from "../../billing/_components/payment-table";
import { AdminCollectionCard, useAdminCollection } from "./admin-collection";

interface SubscriptionRow {
  userId: string;
  plan: string;
  effectivePlan: string;
  status: string;
  provider: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  user: { name: string | null; email: string };
}
export function AdminPayments() {
  const summary = useApiResource<{ payments: number; paid: number; pending: number; activePro: number }>(
    "/admin/payments/summary",
  );
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Alert>
        <FlaskConical />
        <AlertTitle>Sandbox billing workspace</AlertTitle>
        <AlertDescription>
          All payments and subscriptions here are test records. No live revenue is collected.
        </AlertDescription>
      </Alert>
      <ResourceState {...summary} retry={summary.reload} />
      {summary.data && !summary.error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Test transactions", summary.data.payments],
            ["Paid test records", summary.data.paid],
            ["Pending test records", summary.data.pending],
            ["Active Pro subscriptions", summary.data.activePro],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardHeader>
                <CardTitle className="text-sm">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold text-2xl tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Tabs defaultValue="payments" className="flex min-w-0 flex-col gap-4">
        <TabsList variant="line">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>
        <TabsContent value="payments">
          <Payments />
        </TabsContent>
        <TabsContent value="subscriptions">
          <Subscriptions />
        </TabsContent>
      </Tabs>
    </div>
  );
}
function Payments() {
  const resource = useAdminCollection<PaymentRow>("payments", { includePeriod: false });
  return (
    <AdminCollectionCard
      title="Test payment ledger"
      description="Review checkout attempts and sandbox invoice outcomes."
      resource={resource}
      toolbar={
        <>
          <CollectionSearch
            value={resource.search}
            onChange={resource.setSearch}
            placeholder="Search account name or email"
          />
          <FilterSelect
            label="Payment status"
            value={resource.filters.status ?? "all"}
            onChange={(value) => resource.setFilter("status", value)}
            options={[
              ["all", "All statuses"],
              ["paid", "Paid"],
              ["pending", "Pending"],
              ["failed", "Failed"],
              ["expired", "Expired"],
              ["void", "Void"],
            ]}
          />
        </>
      }
    >
      <PaymentTable items={resource.data?.items ?? []} admin />
    </AdminCollectionCard>
  );
}
function Subscriptions() {
  const resource = useAdminCollection<SubscriptionRow>("payments/subscriptions", { includePeriod: false });
  return (
    <AdminCollectionCard
      title="Subscriptions"
      description="Effective access reflects payment status and the current period end."
      resource={resource}
      toolbar={
        <CollectionSearch
          value={resource.search}
          onChange={resource.setSearch}
          placeholder="Search account name or email"
        />
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Account</TableHead>
            <TableHead>Effective plan</TableHead>
            <TableHead>Environment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Period ends</TableHead>
            <TableHead className="pr-6">Renewal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resource.data?.items.map((row) => (
            <TableRow key={row.userId}>
              <TableCell className="pl-6">
                <div className="flex flex-col gap-1">
                  <span>{row.user.name ?? "Account"}</span>
                  <span className="text-muted-foreground text-xs">{row.user.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={row.effectivePlan === "PRO" ? "secondary" : "outline"}>{row.effectivePlan}</Badge>
              </TableCell>
              <TableCell>{row.provider === "DEMO" ? "Demo" : "Stripe sandbox"}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString() : "—"}</TableCell>
              <TableCell className="pr-6">{renewalLabel(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminCollectionCard>
  );
}

function renewalLabel(row: SubscriptionRow) {
  if (row.cancelAtPeriodEnd) return "Cancellation scheduled";
  if (row.provider === "DEMO") return "Does not renew";
  return row.effectivePlan === "PRO" ? "Test auto-renewal" : "Inactive";
}
