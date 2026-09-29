import { KeyRound } from "lucide-react";
import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { ApiKeysWorkspace } from "../_components/api-keys-workspace";

export const metadata: Metadata = { title: "API Keys · MarketPilot" };

export default function ApiKeysPage() {
  return (
    <MarketPilotPage
      title="API keys"
      description="Review access key configuration and scopes. This preview never generates or stores a secret."
      actions={<KeyRound className="size-5 text-muted-foreground" aria-hidden="true" />}
    >
      <ApiKeysWorkspace />
    </MarketPilotPage>
  );
}
