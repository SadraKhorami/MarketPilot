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
      description="Create and manage saved market alert rules for your account."
      actions={
        <Button variant="outline" disabled>
          <BellRing /> Evaluation not enabled
        </Button>
      }
    >
      <AlertManager />
    </MarketPilotPage>
  );
}
