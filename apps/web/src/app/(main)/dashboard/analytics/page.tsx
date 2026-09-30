import type { Metadata } from "next";

import { MarketDataWorkspace } from "../_components/market-data-workspace";

export const metadata: Metadata = { title: "Analytics · MarketPilot" };

export default function AnalyticsPage() {
  return (
    <MarketDataWorkspace
      title="Analytics"
      description="Study one product across price history, momentum, trend, volatility, and provider-derived levels."
      mode="analytics"
    />
  );
}
