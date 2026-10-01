import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { BotIntegration } from "../_components/bot-integration";

type BotPageProps = { params: Promise<{ provider: string }> };

export async function generateMetadata({ params }: BotPageProps): Promise<Metadata> {
  const { provider } = await params;
  const names = { telegram: "Telegram", discord: "Discord" } as const;
  const name = names[provider as keyof typeof names] ?? "Bot";
  return { title: `${name} · MarketPilot` };
}

export default async function BotPage({ params }: BotPageProps) {
  const { provider } = await params;
  if (provider !== "telegram" && provider !== "discord") notFound();
  const name = provider === "telegram" ? "Telegram" : "Discord";
  return (
    <MarketPilotPage
      title={name}
      description={`Connect your ${name} account for private market research and alert notifications.`}
    >
      <BotIntegration key={provider} provider={provider} />
    </MarketPilotPage>
  );
}
