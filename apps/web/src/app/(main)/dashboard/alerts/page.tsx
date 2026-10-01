import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { AlertManager } from "./_components/alert-manager";

export const metadata: Metadata = { title: "Alerts · MarketPilot" };

export default function AlertsPage() {
  return (
    <MarketPilotPage
      title="Alerts"
      description="Track price, RSI and candle change crossings with inbox and opted-in bot delivery."
    >
      <AlertManager />
    </MarketPilotPage>
  );
}
