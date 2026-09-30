import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { AdminKeys } from "../_components/admin-keys";
export const metadata: Metadata = { title: "API management · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage
      title="API management"
      description="Review credentials, owners and supported developer capabilities."
    >
      <AdminKeys />
    </MarketPilotPage>
  );
}
