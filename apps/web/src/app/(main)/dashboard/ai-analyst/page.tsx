import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { AIAnalystWorkspace } from "./_components/ai-analyst-workspace";

export const metadata: Metadata = { title: "AI Analyst · MarketPilot" };

export default function AIAnalystPage() {
  return (
    <MarketPilotPage
      title="AI Analyst"
      description="Turn market data into better questions. Explore prices, compare assets and prepare your next research brief."
    >
      <AIAnalystWorkspace />
    </MarketPilotPage>
  );
}
