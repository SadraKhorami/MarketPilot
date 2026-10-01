import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { type PaymentRow, testAmount } from "./billing-types";
export function PaymentTable({ items, admin = false }: { items: PaymentRow[]; admin?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {admin && <TableHead className="pl-6">Account</TableHead>}
          <TableHead className={admin ? undefined : "pl-6"}>Date</TableHead>
          <TableHead>Environment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Test amount</TableHead>
          <TableHead className="pr-6 text-right">Receipt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((payment) => (
          <TableRow key={payment.id}>
            {admin && (
              <TableCell className="pl-6">
                <div className="flex flex-col gap-1">
                  <span>{payment.user?.name ?? "Account"}</span>
                  <span className="text-muted-foreground text-xs">{payment.user?.email}</span>
                </div>
              </TableCell>
            )}
            <TableCell className={admin ? undefined : "pl-6"}>
              {new Date(payment.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{payment.provider === "DEMO" ? "Demo" : "Stripe sandbox"}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={payment.status === "paid" ? "secondary" : "outline"}>{payment.status}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{testAmount(payment)}</TableCell>
            <TableCell className="pr-6 text-right">
              {payment.hostedInvoiceUrl && /^https:\/\/invoice\.stripe\.com\//.test(payment.hostedInvoiceUrl) ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={payment.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                    Test receipt
                    <ExternalLink data-icon="inline-end" />
                  </a>
                </Button>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {payment.provider === "DEMO" ? "No charge" : "Not issued"}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
