import type { Metadata } from "next";

import { JournalWorkspace } from "./_components/journal-workspace";
export const metadata: Metadata = { title: "Journal · MarketPilot" };
export default function JournalPage() {
  return <JournalWorkspace />;
}
