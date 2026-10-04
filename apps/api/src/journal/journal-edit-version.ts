import { createHash } from "node:crypto";
import type { Prisma } from "@marketpilot/db";

// Monitoring timestamps and observations do not change the user's editable trade.
export function journalEditVersion(entry: Prisma.JournalEntryGetPayload<{ include: { exits: true } }>) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        symbol: entry.symbol,
        plan: entry.plan,
        status: entry.status,
        notes: entry.notes,
        entryPrice: entry.entryPrice,
        quantity: entry.quantity,
        fees: entry.fees,
        exitPrice: entry.exitPrice,
        openedAt: entry.openedAt,
        closedAt: entry.closedAt,
        trackingMode: entry.trackingMode,
        entryTrigger: entry.entryTrigger,
        targetAllocations: entry.targetAllocations,
        resultBasis: entry.resultBasis,
        archivedAt: entry.archivedAt,
        exits: [...entry.exits].sort((a, b) => a.id.localeCompare(b.id)),
      }),
    )
    .digest("hex");
}
