import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { AIAnalystWorkspace } from "./_components/ai-analyst-workspace";

export const metadata: Metadata = { title: "AI Analyst · MarketPilot" };

export default function AIAnalystPage() {
  return (
    <MarketPilotPage
      title="AI Analyst"
      description="Research assets and your watchlist with sourced market observations and AI interpretation."
    >
      <AIAnalystWorkspace />
    </MarketPilotPage>
  );
}
