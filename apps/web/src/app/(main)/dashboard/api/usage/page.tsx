import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { ApiUsageWorkspace } from "../_components/api-usage-workspace";

export const metadata: Metadata = { title: "API Usage · MarketPilot" };

export default function ApiUsagePage() {
  return (
    <MarketPilotPage
      title="API usage"
      description="Track requests made with your API keys, response outcomes and performance."
    >
      <ApiUsageWorkspace />
    </MarketPilotPage>
  );
}
