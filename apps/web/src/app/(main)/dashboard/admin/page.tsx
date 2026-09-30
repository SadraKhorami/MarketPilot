import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { AdminOverviewWorkspace } from "./_components/admin-overview";
export const metadata: Metadata = { title: "Administration · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage title="Administration" description="Monitor accounts, credentials and authenticated traffic.">
      <AdminOverviewWorkspace />
    </MarketPilotPage>
  );
}
