import type { Metadata } from "next";

import { MarketPilotPage } from "../_components/marketpilot-page";
import { ProfileWorkspace } from "./_components/profile-workspace";

export const metadata: Metadata = { title: "Profile · MarketPilot" };

export default function ProfilePage() {
  return (
    <MarketPilotPage title="Profile" description="Your MarketPilot identity and account details.">
      <ProfileWorkspace />
    </MarketPilotPage>
  );
}
