import type { ReactNode } from "react";

import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";

import { MarketPilotPage } from "../_components/marketpilot-page";

export const metadata: Metadata = {
  title: "Development docs · MarketPilot",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <MarketPilotPage
      title="Development docs"
      description="Your workspace playbook. Run locally, understand the architecture and prepare an Ubuntu deployment."
      actions={<Badge variant="secondary">Development only</Badge>}
    >
      {children}
    </MarketPilotPage>
  );
}
