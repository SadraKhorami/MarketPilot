import type { Metadata } from "next";
import { JournalAnalyticsWorkspace } from "../_components/journal-analytics";
export const metadata: Metadata = { title: "Journal analytics · MarketPilot" };
export default function JournalAnalyticsPage() {
  return <JournalAnalyticsWorkspace />;
}
