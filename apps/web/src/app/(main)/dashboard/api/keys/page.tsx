import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { ApiKeysWorkspace } from "../_components/api-keys-workspace";

export const metadata: Metadata = { title: "API Keys · MarketPilot" };

export default function ApiKeysPage() {
  return (
    <MarketPilotPage
      title="API keys"
      description="Create scoped credentials, review usage, and revoke keys you no longer need."
    >
      <ApiKeysWorkspace />
    </MarketPilotPage>
  );
}
