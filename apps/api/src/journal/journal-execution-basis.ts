import type { Prisma } from "@marketpilot/db";

type Event = { key: string; evidence: Prisma.JsonValue };
export function hasEstimatedEntry(events: Event[]) {
  return (
    events.some((event) => event.key === "auto:entry") &&
    !events.some((event) => {
      const evidence = event.evidence;
      return (
        typeof evidence === "object" &&
        evidence !== null &&
        !Array.isArray(evidence) &&
        evidence.actualEntryConfirmed === true
      );
    })
  );
}
