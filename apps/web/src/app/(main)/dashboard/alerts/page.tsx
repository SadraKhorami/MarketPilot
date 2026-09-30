import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { AlertManager } from "./_components/alert-manager";

export const metadata: Metadata = { title: "Alerts · MarketPilot" };

export default function AlertsPage() {
  return (
    <MarketPilotPage
      title="Alerts"
      description="Save price and indicator conditions to review later. Rules are not evaluated or delivered yet."
    >
      <AlertManager />
    </MarketPilotPage>
  );
}
