import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { WatchlistManager } from "./_components/watchlist-manager";

export const metadata: Metadata = { title: "Watchlist · MarketPilot" };

export default function WatchlistPage() {
  return (
    <MarketPilotPage
      title="Watchlist"
      description="Manage saved symbols and load provider-backed price and trend data."
    >
      <WatchlistManager />
    </MarketPilotPage>
  );
}
