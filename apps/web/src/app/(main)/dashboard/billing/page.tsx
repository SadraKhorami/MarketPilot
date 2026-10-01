import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { BillingWorkspace } from "./_components/billing-workspace";
export const metadata: Metadata = { title: "Billing · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage
      title="Billing & plans"
      description="Manage your test subscription, compare plans and track your allowance."
    >
      <BillingWorkspace />
    </MarketPilotPage>
  );
}
