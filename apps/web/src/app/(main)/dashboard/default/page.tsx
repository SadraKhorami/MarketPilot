import type { Metadata } from "next";

import { MarketDataWorkspace } from "../_components/market-data-workspace";

export const metadata: Metadata = { title: "Dashboard · MarketPilot" };

export default function DashboardPage() {
  return (
    <MarketDataWorkspace
      title="Market overview"
      description="Verified Coinbase Exchange observations, candle history, and calculated technical analysis."
    />
  );
}
