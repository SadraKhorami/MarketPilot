import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { WatchlistManager } from "./_components/watchlist-manager";

export const metadata: Metadata = { title: "Watchlist · MarketPilot" };

export default function WatchlistPage() {
  return (
    <MarketPilotPage title="Watchlist" description="Your saved markets, prices and recent movement in one place.">
      <WatchlistManager />
    </MarketPilotPage>
  );
}
