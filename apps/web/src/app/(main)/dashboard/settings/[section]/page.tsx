import { notFound, permanentRedirect } from "next/navigation";

import type { Metadata } from "next";

import { MarketPilotPage } from "../../_components/marketpilot-page";
import { SettingsPanel, type SettingsSection } from "../_components/settings-panel";

type SettingsPageProps = { params: Promise<{ section: string }> };
const sections: SettingsSection[] = ["security", "notifications", "appearance"];
const descriptions: Record<SettingsSection, string> = {
  security: "Security controls and session status for the future authenticated workspace.",
  notifications: "Choose which updates would be enabled after notification services are connected.",
  appearance: "Choose a theme for the MarketPilot workspace.",
};

export async function generateMetadata({ params }: SettingsPageProps): Promise<Metadata> {
  const { section } = await params;
  return { title: `${section.charAt(0).toUpperCase()}${section.slice(1)} settings · MarketPilot` };
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { section } = await params;
  if (section === "profile") permanentRedirect("/dashboard/profile");
  if (!sections.includes(section as SettingsSection)) notFound();
  const active = section as SettingsSection;
  return (
    <MarketPilotPage
      title={`${active.charAt(0).toUpperCase()}${active.slice(1)} settings`}
      description={descriptions[active]}
    >
      <SettingsPanel section={active} />
    </MarketPilotPage>
  );
}
