import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DemoDataNotice() {
  return (
    <Alert className="border-primary/20 bg-primary/[0.035]">
      <Info aria-hidden="true" />
      <AlertTitle>Demo workspace · sample data only</AlertTitle>
      <AlertDescription>
        Market prices and activity are illustrative local fixtures. Live market feeds, AI tools, alerts, and
        integrations are not connected.
      </AlertDescription>
    </Alert>
  );
}
