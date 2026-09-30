import { CreditCard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
export function AdminPayments() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments & billing</CardTitle>
        <CardDescription>A dedicated workspace for future transactions, subscriptions and invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCard />
            </EmptyMedia>
            <EmptyTitle>Billing is not connected</EmptyTitle>
            <EmptyDescription>
              There is no payment provider or transaction ledger yet. Transactions will appear here after billing is
              implemented.
            </EmptyDescription>
          </EmptyHeader>
          <Badge variant="outline">Not available yet</Badge>
        </Empty>
      </CardContent>
    </Card>
  );
}
