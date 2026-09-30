import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { AdminNotifications } from "./_components/admin-notifications";
export const metadata: Metadata = { title: "Administrative notifications · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage title="Notification management" description="Create announcements and review in-app delivery.">
      <AdminNotifications />
    </MarketPilotPage>
  );
}
