import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { AdminSystem } from "../_components/admin-system";
export const metadata: Metadata = { title: "System · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage title="System" description="Monitor infrastructure, queues, bots and AI operations.">
      <AdminSystem />
    </MarketPilotPage>
  );
}
