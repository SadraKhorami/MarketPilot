import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { AdminPayments } from "../_components/admin-payments";
export const metadata: Metadata = { title: "Payments · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage title="Payments" description="Manage billing when the payment integration is available.">
      <AdminPayments />
    </MarketPilotPage>
  );
}
