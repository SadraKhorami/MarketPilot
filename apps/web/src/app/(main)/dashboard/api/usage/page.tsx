import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { ApiUsageWorkspace } from "../_components/api-usage-workspace";

export const metadata: Metadata = { title: "API Usage · MarketPilot" };

export default async function ApiUsagePage({ searchParams }: { searchParams: Promise<{ keyId?: string }> }) {
  const { keyId } = await searchParams;
  return (
    <MarketPilotPage
      title="API usage"
      description="Track requests made with your API keys, response outcomes and performance."
    >
      <ApiUsageWorkspace key={keyId ?? "all"} initialKeyId={keyId} />
    </MarketPilotPage>
  );
}
