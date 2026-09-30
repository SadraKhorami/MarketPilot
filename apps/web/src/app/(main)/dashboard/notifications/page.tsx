import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { NotificationInbox } from "./_components/notification-inbox";
export const metadata: Metadata = { title: "Notifications · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage title="Notifications" description="Stay up to date with your account and workspace.">
      <NotificationInbox />
    </MarketPilotPage>
  );
}
