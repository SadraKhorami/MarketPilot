import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { ActivityTimeline } from "./_components/activity-timeline";

export const metadata: Metadata = { title: "Activity · MarketPilot" };
export default function ActivityPage() {
  return (
    <MarketPilotPage
      title="Activity"
      description="Review account changes and security events recorded for your account."
    >
      <ActivityTimeline />
    </MarketPilotPage>
  );
}
