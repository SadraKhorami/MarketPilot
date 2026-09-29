import type { Metadata } from "next";

import { MarketDataWorkspace } from "../../_components/market-data-workspace";

export const metadata: Metadata = { title: "Asset details · MarketPilot" };

export default async function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return (
    <MarketDataWorkspace
      title={`${symbol.toUpperCase()} market data`}
      description="MarketFeed price history, technical indicators, trend information, and provider timestamps."
      initialSymbol={symbol}
    />
  );
}
