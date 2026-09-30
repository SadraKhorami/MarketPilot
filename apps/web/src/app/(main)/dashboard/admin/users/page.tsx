import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { AdminUsers } from "../_components/admin-users";
export const metadata: Metadata = { title: "Users · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage title="Users" description="Review workspace accounts and their access.">
      <AdminUsers />
    </MarketPilotPage>
  );
}
