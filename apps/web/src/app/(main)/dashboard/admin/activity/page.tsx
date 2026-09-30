import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { AdminAudit } from "../_components/admin-logs";
export const metadata: Metadata = { title: "Audit log · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage title="Audit log" description="Follow account actions across the workspace.">
      <AdminAudit />
    </MarketPilotPage>
  );
}
