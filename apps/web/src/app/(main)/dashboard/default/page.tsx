import type { Metadata } from "next";

import { DashboardOverview } from "./_components/dashboard-overview";

export const metadata: Metadata = { title: "Dashboard · MarketPilot" };

export default function DashboardPage() {
  return <DashboardOverview />;
}
