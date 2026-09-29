import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SupportCard() {
  return (
    <Card size="sm" className="overflow-hidden shadow-none group-data-[collapsible=icon]:hidden">
      <CardHeader className="min-w-0 px-4">
        <CardTitle className="truncate text-sm">Data provenance</CardTitle>
        <CardDescription className="line-clamp-3">
          Market observations show their provider timestamp and cache state. Unavailable values are not estimated.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
