import { BellRing } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { AlertManager } from "./_components/alert-manager";

export const metadata: Metadata = { title: "Alerts · MarketPilot" };

export default function AlertsPage() {
  return (
    <MarketPilotPage
      title="Alerts"
      description="Configure conditions and notification preferences for a future connected workspace."
      actions={
        <Button variant="outline" disabled>
          <BellRing /> Alert service disconnected
        </Button>
      }
    >
      <AlertManager />
    </MarketPilotPage>
  );
}
