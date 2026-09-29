import { Bookmark } from "lucide-react";
import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { WatchlistManager } from "./_components/watchlist-manager";

export const metadata: Metadata = { title: "Watchlist · MarketPilot" };

export default function WatchlistPage() {
  return (
    <MarketPilotPage
      title="Watchlist"
      description="Organize saved assets for your account. Market prices and changes remain sample data."
      actions={<Bookmark className="size-5 text-muted-foreground" aria-hidden="true" />}
    >
      <WatchlistManager />
    </MarketPilotPage>
  );
}
