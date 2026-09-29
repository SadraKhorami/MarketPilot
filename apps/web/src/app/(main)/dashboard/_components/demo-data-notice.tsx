import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DemoDataNotice() {
  return (
    <Alert className="border-primary/20 bg-primary/[0.035]">
      <Info aria-hidden="true" />
      <AlertTitle>Market data and news sources</AlertTitle>
      <AlertDescription>
        Market observations are fetched and validated by MarketPilot using Coinbase Exchange. Source timestamps and
        stale or unavailable states are shown; unsupported pairs are never estimated. News uses a separate RSS worker
        and remains disabled until its display terms are approved.
      </AlertDescription>
    </Alert>
  );
}
