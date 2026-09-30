import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { MarketsExplorer } from "./_components/markets-explorer";

export const metadata: Metadata = { title: "Markets · MarketPilot" };

export default function MarketsPage() {
  return (
    <MarketPilotPage
      title="Markets"
      description="Search market products, compare live provider observations, and open a product to review its price history."
    >
      <MarketsExplorer />
    </MarketPilotPage>
  );
}
