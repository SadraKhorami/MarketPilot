import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { ApiDocumentation } from "../_components/api-documentation";
export const metadata: Metadata = { title: "API documentation · MarketPilot" };
export default function Page() {
  return (
    <MarketPilotPage
      title="Developer API"
      description="Read market data, sourced news and your saved resources from your own integrations."
    >
      <ApiDocumentation />
    </MarketPilotPage>
  );
}
