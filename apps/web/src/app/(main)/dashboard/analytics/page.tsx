import type { Metadata } from "next";

import { MarketDataWorkspace } from "../_components/market-data-workspace";

export const metadata: Metadata = { title: "Analytics · MarketPilot" };

export default function AnalyticsPage() {
  return (
    <MarketDataWorkspace
      title="Analytics"
      description="Review indicators and support, resistance, and volatility fields returned by MarketFeed."
      mode="analytics"
    />
  );
}
