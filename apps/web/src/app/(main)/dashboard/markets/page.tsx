import type { Metadata } from "next";

import { MarketDataWorkspace } from "../_components/market-data-workspace";

export const metadata: Metadata = { title: "Markets · MarketPilot" };

export default function MarketsPage() {
  return (
    <MarketDataWorkspace
      title="Markets"
      description="Explore Coinbase Exchange crypto products with provider timestamps, candles, and calculated technical indicators."
    />
  );
}
