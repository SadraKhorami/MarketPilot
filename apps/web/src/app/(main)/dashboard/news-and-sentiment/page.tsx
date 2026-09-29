import { Newspaper } from "lucide-react";
import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { NewsExplorer } from "./_components/news-explorer";

export const metadata: Metadata = { title: "News & Sentiment · MarketPilot" };

export default function NewsPage() {
  return (
    <MarketPilotPage
      title="News & Sentiment"
      description="Review sample headlines and asset sentiment. Article content here is illustrative, not current news."
      actions={<Newspaper className="size-5 text-muted-foreground" aria-hidden="true" />}
    >
      <NewsExplorer />
    </MarketPilotPage>
  );
}
