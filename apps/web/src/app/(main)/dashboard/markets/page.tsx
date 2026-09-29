import type { Metadata } from "next";

import { MarketDataWorkspace } from "../_components/market-data-workspace";

export const metadata: Metadata = { title: "Markets · MarketPilot" };

export default function MarketsPage() {
  return (
    <MarketDataWorkspace
      title="Markets"
      description="Load any provider-supported MarketFeed symbol to view its actual price, candles, indicators, and trend."
    />
  );
}
