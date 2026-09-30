import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { AdminRequests } from "../_components/admin-logs";
export const metadata: Metadata = { title: "Request logs · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage title="Request logs" description="Inspect browser traffic and developer API requests.">
      <AdminRequests />
    </MarketPilotPage>
  );
}
