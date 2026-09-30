import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { NewsExplorer } from "./_components/news-explorer";

export const metadata: Metadata = { title: "News & Sentiment · MarketPilot" };

export default function NewsPage() {
  return (
    <MarketPilotPage
      title="News & Sentiment"
      description="Your market reading desk. Discover the latest coverage, explore sources and keep the stories that matter."
    >
      <NewsExplorer />
    </MarketPilotPage>
  );
}
